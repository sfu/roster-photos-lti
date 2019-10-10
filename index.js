const https = require('https');
const path = require('path');
const fs = require('fs');
const url = require('url');
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const redis = require('redis');
const RedisStore = require('connect-redis')(session);
const axios = require('axios').default;
const LTI = require('ims-lti');
const Sentry = require('@sentry/node');
const PhotoClient = require('node-sfu-photos-client');
const RedisNonceStore = require('ims-lti/lib/redis-nonce-store');
const hasLaunchForCourse = require('./lib/hasLaunchForCourse');

const noPhotoImage = fs
  .readFileSync(path.resolve(__dirname, 'public/no_photo.png'))
  .toString('base64');

const {
  HTTP_PORT = 3000,
  REDIS_URL,
  LTI_SECRET,
  SESSION_SECRET,
  CANVAS_API_KEY,
  PHOTO_CLIENT_ENDPOINT,
  PHOTO_CLIENT_USERNAME,
  PHOTO_CLIENT_PASSWORD,
  PHOTO_CLIENT_CACHE_REDIS_HOST,
  PHOTO_CLIENT_CACHE_REDIS_PORT = 6379,
  PHOTO_CLIENT_MAX_PER_REQUEST = 10,
  PHOTO_CLIENT_MAX_WIDTH = 200,
  SENTRY_DSN,
  NODE_ENV,
} = process.env;

const redisClient = redis.createClient({ url: REDIS_URL });
const nonceStore = new RedisNonceStore('rosterphotos', redisClient);
const ltiProvider = new LTI.Provider('rosterphotos', LTI_SECRET, nonceStore);

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
  });
}

const app = express();
if (SENTRY_DSN) {
  app.use(Sentry.Handlers.requestHandler());
}
app.set('trust proxy', 1);
app.use(bodyParser.urlencoded({ extended: true }));
app.use(
  session({
    store: new RedisStore({ client: redisClient }),
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: true },
  })
);
app.set('view engine', 'ejs');
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.send('Roster Photos LTI\n');
});

app.get('/isup', (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.status(200).send('ok');
});

app.post('/launch', (req, res) => {
  ltiProvider.valid_request(req, function(err, isValid) {
    if (err) {
      console.log(err, req.body);
      const errorId = Sentry.captureException(err);
      res
        .status(500)
        .send(
          `<p>An error occurred while launching Roster Photos. This error has been reported to the SFU Canvas technical team. Error reference: ${errorId}</p>`
        );
    } else if (!isValid) {
      // TODO redirect to a proper unauthorized page
      res.status(403);
    } else {
      const courseId = ltiProvider.body.custom_canvas_course_id;
      req.session.launches = req.session.launches || {};
      req.session.launches[courseId] = ltiProvider.body;
      // req.session.launches[courseId].body = provider.body;
      res.render('index', {
        course: ltiProvider.body,
        title: 'Course Roster',
      });
    }
  });
});

app.get('/:course', hasLaunchForCourse, async (req, res) => {
  const launchData = req.session.launches[req.params.course];
  const parsedUrl = url.parse(launchData.launch_presentation_return_url);
  const courseId = launchData.custom_canvas_course_id;
  const apiUrl = `${parsedUrl.protocol}//${parsedUrl.host}/api/v1/courses/${courseId}/users`;
  const params = {
    enrollment_type: 'student',
    per_page: '3000',
  };

  try {
    const axiosOpts = {
      headers: {
        Authorization: `Bearer ${CANVAS_API_KEY}`,
      },
    };

    if (NODE_ENV !== 'production') {
      axiosOpts.httpsAgent = new https.Agent({
        rejectUnauthorized: false,
      });
    }

    const canvasApi = axios.create(axiosOpts);
    const response = await canvasApi.get(apiUrl, {
      params,
    });

    const roster = response.data;

    if (!roster || !roster.length) {
      // render no students view
      return res
        .status(200)
        .send(
          '<p>There do not appear to be any students enrolled in this course.</p>'
        );
    }

    const sfuIds = roster.map(u => u.sis_user_id);
    const photoClient = new PhotoClient({
      endpoint: PHOTO_CLIENT_ENDPOINT,
      username: PHOTO_CLIENT_USERNAME,
      password: PHOTO_CLIENT_PASSWORD,
      maxPhotosPerRequest: parseInt(PHOTO_CLIENT_MAX_PER_REQUEST),
      maxWidth: parseInt(PHOTO_CLIENT_MAX_WIDTH),
      cache: {
        store: 'redis',
        options: {
          redisHost: PHOTO_CLIENT_CACHE_REDIS_HOST,
          redisPort: PHOTO_CLIENT_CACHE_REDIS_PORT,
        },
      },
    });

    // fetch photo data from API
    const photoData = await photoClient.getPhoto(sfuIds);

    // Some IDs do not have photos associated with them and will be
    // undefined in the photos array. Replace with placeholder data.
    const normalizedPhotos = photoData.map((photo, index) => {
      const canvasProfileUrl = `${parsedUrl.protocol}//${parsedUrl.host}/courses/${courseId}/users/${roster[index].id}`;
      if (!photo) {
        const [LastName, FirstName] = roster[index].sortable_name.split(', ');
        const photoData = {
          LastName,
          FirstName,
          SfuId: roster[index].sis_user_id,
          PictureIdentification: noPhotoImage,
          canvasProfileUrl,
        };
        return photoData;
      } else {
        photo.canvasProfileUrl = canvasProfileUrl;
        return photo;
      }
    });

    res.render('photos', { layout: false, photoData: normalizedPhotos });
  } catch (error) {
    const errorId = Sentry.captureException(error);
    console.log(error);
    res
      .status(500)
      .send(
        `<p>An error occurred while retreiving the roster photos for this course. This error has been reported to the SFU Canvas technical team.</p><p>Error ID: ${errorId}</p>`
      );
  }
});

if (SENTRY_DSN) {
  app.use(Sentry.Handlers.errorHandler());
}

app.listen(HTTP_PORT);
console.log(`Listening on ${HTTP_PORT}`);
