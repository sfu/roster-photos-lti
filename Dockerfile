FROM node:10.16.3-alpine

RUN apk --no-cache add --virtual \
  builds-deps \
  build-base \
  python \
  git \
  inotify-tools

WORKDIR /usr/src/app
COPY package*.json ./
COPY yarn.lock ./
COPY . .
RUN mkdir -p /home/nodejs/.cache/yarn
RUN yarn install --pure-lockfile
CMD ["yarn", "start"]
EXPOSE 3000