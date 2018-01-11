# Dokumentation und Walk-Through für einen SSL-geschützten MEAN-Stack hinter einem NGINX-Reverse-Proxy

## Die Angular-4ff-App
```
# Vergewisserung, dass Docker installiert ist
docker -v
#
# Angular-Command-Line-Interface global pinstallieren
npm install -g @angular/cli
#
# Projekt-Verzeichnis installieren
mkdir mean-proxy-ssl-tutorial
cd mean-proxy-ssl-tutorial
# 
# Angular 4 App als Client initialisieren
ng new ng4-client
cd ng4-client
#
# Angular testweise starten. Die Angabe 
# zum Port muss nicht gemacht werden.
# Nur nötig, falls aber ein anderer als 
# der Port 4200 angesteuert werden soll.
ng serve -p 4200
#
# Test und beenden von Angular
curl http://localhost:4200
^c
```
An dieser Stelle müssen wir das Terminal verlassen und im Verzeichnis `ng4-client` das `Dockerfile` anlegen.

```sh
### STAGE 1: Build ###
# We label our stage as 'builder'
FROM node:8-alpine as builder
COPY package.json ./
RUN npm set progress=false && npm config set depth 0 && npm cache clean --force
## Storing node modules on a separate layer will 
## prevent unnecessary npm installs at each build
RUN npm i && mkdir /ng-app && cp -R ./node_modules ./ng-app
WORKDIR /ng-app
COPY . .
## Build the angular app in production mode and store the artifacts in dist folder
## RUN $(npm bin)/ng build --prod --build-optimizer
EXPOSE 4210
# Serve the app
CMD ["npm", "start"]
```
Anlegen eines `.dockerignore`-Files mit folgendem Inhalt:

```sh
node_modules/
.git
.gitignore
``` 
Im File `ng4-client/package.json` wird der Inhalt unter dem `script`-Tag folgendermaßen geändert: 

```js
"scripts": {
	...
    "start": "ng serve -H 0.0.0.0",
	...
},
```

Nun kann das Docker-Image gebaut und gestartet werden: 
```sh
## Build
docker build -t ng-client:dev .
## Run
docker run -d --name ng4-client -p 4210:4210 ng-client:dev
## Unter http://localhost:4210 müsste sich nun Angular 4 melden.
docker stop ng-client
```

## Aufsetzen und Dockerisieren des Express-Servers

```sh
## Wechsel ins Root-Verzeichnis des Projekts
cd ..
## Anlegen von Verzeichnissen und Basis-Dateien
mkdir server
cd server
touch server.js
mkdir routes && cd routes
touch api.js
```  

Befüllen der Files mit Inhalt: 

server/server.js

```js
// Get dependencies
const express = require('express');
const path = require('path');
const http = require('http');
const bodyParser = require('body-parser');

// Get our API routes
const api = require('./routes/api');

const app = express();

// Parsers for POST data
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// Set our api routes
app.use('/', api);

/**
 * Get port from environment and store in Express.
 */
const port = process.env.PORT || '3000';
app.set('port', port);

/**
 * Create HTTP server.
 */
const server = http.createServer(app);

/**
 * Listen on provided port, on all network interfaces.
 */
server.listen(port, () => console.log(`API running on localhost:${port}`));
```

server/routes/api.js

```js
const express = require('express');
const router = express.Router();

/* GET api listing. */
router.get('/', (req, res) => {
    res.send('api works');
});

module.exports = router;
```
Zuletzt muss die Datei `package.json` ergänzt werden: 

```js
{
  "name": "express-server",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "body-parser": "~1.18.2",
    "express": "~4.15.5"
  }
}
```

Testen des Node-Express-Servers:
```sh
npm install
npm start
```

