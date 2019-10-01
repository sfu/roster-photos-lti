const express = require('express');

// Constants
const { HTTP_PORT = 3000 } = process.env;

// App
const app = express();
app.get('/', (req, res) => {
  res.send('Hello world\n');
});

app.listen(HTTP_PORT);
console.log(`Listening on ${HTTP_PORT}`);
