
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
Zuletzt muss die Datei [`package.json`](https://github.com/waynem59/mean-proxy-ssl-docker/blob/d9b0bede3f2ab8b91a9a026dbe0a10d3c9070220/server/package.json) ergänzt werden

Testen des Node-Express-Servers:
```sh
npm install
npm start
```

Dockerisierung durch Anlegen der Files `Dockerfile` und `.dockerignore`. Letzteres kann zur Vereinfachung als Kopie aus dem Verzeichnis `ng4-client` nach `server` geholt werden. 

server/Dockerfile

```sh
FROM node:8-alpine as builder
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app
COPY package.json /usr/src/app
RUN npm install
COPY . /usr/src/app
EXPOSE 3000
CMD ["npm", "start"]
```
Bauen des Docker-Images und starten des Docker-Containers
```sh
docker build -t server:dev .
docker run -d --name server -p 3000:3000 server:dev
```

Die Eingabe von `docker ps -a` im Terminal muss nun sinngemäß zu folgendem Ergebnis führen: 

```sh
CONTAINER ID        IMAGE               COMMAND             CREATED             STATUS              PORTS                    NAMES
7c0e9f3aa7e0        server:dev          "npm start"         22 seconds ago      Up 14 seconds       0.0.0.0:3000->3000/tcp   server
e82324a2ae85        ng-client:dev       "npm start"         12 hours ago        Up 12 hours         0.0.0.0:4210->4210/tcp   ng4-client 
```

Entsprechend führt `docker image ls" zu: 

```sh
REPOSITORY          TAG                 IMAGE ID            CREATED             SIZE
server              dev                 33eb77df01ce        8 minutes ago       71.1MB
ng-client           dev                 81d239432022        12 hours ago        606MB
```
Die angezeigten Container können danach mit `docker stop server ng4-client` wieder gestoppt werden. 

## Einführung von `docker-compose` 

Wechseln ins Root-Verzeichnis des Projekts und Anlegen der Datei `docker-compose.yml` mit folgendem Inhalt: 

```sh
version: '3'

services:
  angular: 
    build: ng4-client 
    ports:
      - "4210:4210"

  server: 
    build: server 
    ports:
      - "3000:3000" 

  database: 
    image: mongo 
    ports:
      - "27017:27017" 
```

Der MongoDB-Container wird hier also in einem Rutsch gleich mit angelegt. Damit wird hier der "diskrete Weg" umgangen, der über das Terminal hätte beschritten werden können: 

```sh
cd ..
docker pull mongo
docker run -d --name mongodb -p 27017:27017 mongo 
```
Diesen Schritt erspart uns die Verwendung von `docker-compose`.  Auf dem Terminal kann nun im Root-Verzeichnis mit `docker-compose up` das gesamte Projekt gebaut und gestartet werden.  

## Verbinden der drei Container

### Bearbeiten des Servers

Ausgangspunkt ist wieder das Root-Verzeichnis
```sh
cd server
npm install mongoose --save 
## Für später ...
npm install mongoose-unique-validator --save 
```

Weitere Schritte: 

* Anlegen einer Datei (`server/routes/users.js`)[./server/routes/users.js].

* Anlegen eines Verzeichnisses `server/models` und dort einer Datei (`server/models/users.js`)[server/models/users.js].

* Ändern bzw. Ergänzen von (`server/server.js`)[./server/server.js].


### Erweitern der `docker-compose`-Datei

Einführung einer Verlinkung zwischen Server und Datenbank:
```sh
  ...
  server: 
    build: server 
    ports:
      - "3000:3000" 
    links: 
      - database  

  database: 
  ...
``` 

### Verknüpfung von Server mit Angular 4

Zunächst wird für die Herstellung der Infrastruktur auf Bootstrap 4 zurückgegriffen. Um der besseren Fokussierung willen erfolgt dies nicht über die Einbindung im Projekt, sondern über Zugriff auf ein CDN in der Datei [`ng4-client/src/index.html`](./ng4-client/src/index.html)-


Die weitere Verknüpfung von Client und Server erfolgt **nicht** nach den Design-Regeln von Angular 4, sondern 'quick and dirty' in der zentralen `app-root`-Komponente [`ng4-client/src/app/app.component.ts`](./ng4-client/src/app/app.component.ts).


Das Template hierzu wird in (`ng4-client/src/app/app.component.html`)[./ng4-client/src/app/app.component.html] angelegt. Schließlich müssen die Ressourcen noch über die Eintragungen in [`ng4-client/src/app/app.module.ts`](./ng4-client/src/app/app.module.ts) bekanntgemacht werden. 


## Hinzufügen des Proxy-Servers

```sh
cd ..
mkdir proxy
cd proxy
touch Dockerfile
touch default.conf
```

proxy/Dockerfile

```sh
FROM nginx:alpine
RUN rm /etc/nginx/conf.d/default.conf
COPY ./default.conf /etc/nginx/conf.d/default.conf
```

[proxy/default.conf](https://github.com/waynem59/mean-proxy-ssl-docker/blob/9b350134818a4ed5a6d913c3f00e1f5410311b16/proxy/default.conf)


Änderungen am [`docker-compose.yml`](https://github.com/waynem59/mean-proxy-ssl-docker/blob/9b350134818a4ed5a6d913c3f00e1f5410311b16/docker-compose.yml)-File sind auch nötig, do dass zum Einen nicht bei jeder Änderung an einem Angular-File der komplette Container neu gebaut werden muss (dazu dient das Volume im "angular"-Container) und dass zum Anderen der Proxy-Container angelegt und mit dem Client verknüpft wird.  


Zu guter Letzt muss eine kleine Anpassung an der [`ng4-client/package.json`](https://github.com/waynem59/mean-proxy-ssl-docker/blob/9b350134818a4ed5a6d913c3f00e1f5410311b16/ng4-client/package.json) vorgenommen werden, so dass während der Entwicklung nicht ausschlißelich über `localhost` auf die Anwendung zugegriffen werden kann. Wenn nun z.B. in `/etc/hosts` ein Eintrag für einen lokalen Server mit anderem Namen angelegt wird, dann kann die App auch unter dem Namen dieses Servers aufgerufen werden. Beispiel: 

`/etx/hosts`

```sh
...
127.0.0.1       localhost
127.0.0.1       www.my-local-server.com
255.255.255.255 broadcasthost
...
```

Nun meldet sich die App auch unter `http://www.my-local-server.com`.

## Sicherung des Proxy-Servers

Im Produktionsmodus wird der Server letztlich mit einem Letsencrypt-Zertifikat gesichert werden. Für die Entwicklungsphase läuft aber ein solches Zertifikat nicht auf einem lokalen Server. Daher muss hier auf selbst-signierte Zertifikate zurückgegriffen werden. 

### Anlegen selbst-signierter Zertifikate

Das Anlegen eines solchen Zertifikates ist in einem Rutsch möglich (siehe [hier](https://wiki.manitu.de/index.php/Server:Selbst-signiertes_SSL-Zertifikat_erstellen/erzeugen)). Zunächst wird ein `temp`-Verzeichnis angelegt, in dem die Zertifikate erzeugt werden: 
```sh
cd ..
mkdir temp
cd temp
openssl req -new -days 999 -newkey rsa:4096 -sha512 -x509 -nodes -out server.crt -keyout server.key
```

Im Einzelnen sind folgende Schritte darin enthalten: 

```sh
## Erzeugen des private key und des certificate signing requests
openssl req -new -keyout server.pem > server.csr

## Private key in RSA (oder anderes Format) umwandeln
openssl rsa -in server.pem -out server.key

## Selbst-signiertes Zertifikat erzeugen
openssl x509 -in server.csr -out server.crt -req -signkey server.key -days 999
```

Wenn das `temp`-Verzeichnis nicht gelöscht wird, so muss es zumindest in `.gitignore`und `.dockerignore` eingetragen werden.

### Übertragung der Zertifikate
Dazu sind zunächst folgende Schritte abzuarbeiten:
* Anlegen eines Verzeichnisses `proxy/certs` und Kopieren der soeben angelegten Zertifikate in dieses Verzeichnis. 
* Änderungen an der [`default.conf`](./proxy/default.conf).


## Deployment

### Betrieb des Projekts auf einer `docker-machine`

### Produktionsmodus für Angular 4

### Umstellen auf Letsencrypt-Zertifikate


