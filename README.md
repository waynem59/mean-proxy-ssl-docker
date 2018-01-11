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
Anlegen einer Datei `server/routes/users.js':
```js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = require('../models/users');

/* GET all users. */
router.get('/', (req, res) => {
    User.find({}, (err, users) => {
        if (err) res.status(500).send(error)

        res.status(200).json(users);
    });
});

/* GET one users. */
router.get('/:id', (req, res) => {
    User.findById(req.param.id, (err, users) => {
        if (err) res.status(500).send(error)

        res.status(200).json(users);
    });
});

/* Create a user. */
router.post('/', (req, res) => {
    let user = new User({
      password: req.body.password, 
      email: req.body.email,
        name: req.body.name,
        age: req.body.age
    });
    user.save(error => {
        if (error) res.status(500).send(error);

        res.status(201).json({
            message: 'User created successfully'
        });
    });
});

module.exports = router;
```

Anlegen eines Verzeichnisses `server/models` und dort einer Datei `server/models/users.js`:

```js
const mongoose = require('mongoose');
const mongooseUniqueValidator = require('mongoose-unique-validator');
const Schema = mongoose.Schema;


// create mongoose schema
const userSchema = new Schema({
    password: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    name: String,
    age: Number
});

module.exports = mongoose.model('User', userSchema);
```

Ändern bzw. Ergänzen von `server/server.js` 
```js
// Get dependencies
const express = require('express');
const path = require('path');
const http = require('http');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');

// Get our API routes
const api = require('./routes/api');
const users = require('./routes/users');

const app = express();
const dbHost = 'mongodb://database:27017/mean-tutorial';

mongoose.connect(dbHost,{useMongoClient: true});


// Parsers for POST data
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use(function(req, res, next) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, PATCH, DELETE, OPTIONS');
    next();
  });

// Set our api routes
app.use('/', api);
app.use('/users', users);

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
server.listen(port, () => console.log(`App is running on localhost:${port}`));
```

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

Zunächst wird für die Herstellung der Infrastruktur auf Bootstrap 4 zurückgegriffen. Um der besseren Fokussierung willen erfolgt dies nicht über die Einbindung im Projekt, sondern über Zugriff auf ein CDN in der Datei `ng4-client/src/index.html`:

```html
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Ng4 Client</title>
  <base href="/">

  <meta name="viewport" content="width=device-width, initial-scale=1">

  <!-- Bootstrap CDN -->
  <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/4.0.0-beta.2/css/bootstrap.min.css">

  <link rel="icon" type="image/x-icon" href="favicon.ico">
</head>
<body>
  <app-root>Loading...</app-root>
</body>
</html>
``` 

Die weitere Verknüpfung von Client und Server erfolgt **nicht** nach den Design-Regeln von Angular 4, sondern 'quick and dirty' in der zentralen `app-root`-Komponente: 

ng4-client/src/app/app.component.ts

```ts
import { Component, OnInit } from '@angular/core';
import { Http } from '@angular/http';

// Import rxjs map operator
import 'rxjs/add/operator/map';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  title = 'app works!';

  // Link to our api, pointing to localhost
  API = 'http://localhost:3000';

  // Declare empty list of people
  people: any[] = [];

  constructor(private http: Http) {}

  // Angular 2 Life Cycle event when component has been initialized
  ngOnInit() {
    this.getAllPeople();
  }

  // Add one person to the API
  addPerson(name, email, password, age) {
    this.http.post(`${this.API}/users`, {
      name: name, 
      email: email,
      password: password, 
      age: age})
      .map(res => res.json())
      .subscribe(() => {
        this.getAllPeople();
      })
  }

  // Get all users from the API
  getAllPeople() {
    this.http.get(`${this.API}/users`)
      .map(res => res.json())
      .subscribe(people => {
        console.log(people)
        this.people = people
      })
  }
}
```

Das Template hierzu wird in `ng4-client/src/app/app.component.html` angelegt: 

```html
<!-- Bootstrap Navbar -->
<nav class="navbar navbar-light bg-faded">
  <div class="container">
    <a class="navbar-brand" href="#">Mean Proxy SSL Tutorial</a>
  </div>
</nav>
<div class="container">
  <div class="row">
    <div class="col-md-6 offset-md-3 col-sm-12">
      <h3>Add new person</h3>
      <form>
        <div class="form-group">
          <label for="name">Name</label>
          <input type="text" class="form-control" id="name" #name>
        </div>
        <div class="form-group">
          <label for="name">Email</label>
          <input type="email" class="form-control" id="email" #email>
        </div>
        <div class="form-group">
          <label for="name">Password</label>
          <input type="password" class="form-control" id="password" #password>
        </div>
        <div class="form-group">
          <label for="age">Age</label>
          <input type="number" class="form-control" id="age" #age>
        </div>
        <button type="button" (click)="addPerson(name.value, email.value, password.value, age.value)" class="btn btn-primary">Add person</button>
      </form>
    </div>
  </div>
  <hr>
  <div class="row">
    <div class="col-md-6 offset-md-3 col-sm-12">
      <h3>People</h3>
      <!-- Bootstrap Card -->
      <div class="card card-block" *ngFor="let person of people">
        <h4 class="card-title">{{person.name}}</h4>
        <hr>
        <p class="card-text">
          <label>Email: </label>{{person.email}}
        </p>
        <p class="card-text">
          <label>Age: </label>{{person.age}}
        </p>
      </div>
    </div>
  </div>
</div>
```
Schließlich müssen die Ressourcen noch über die Eintragungen in `ng4-client/src/app/app.module.ts` bekanntgemacht werden. 

```ts
import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpModule } from '@angular/http';

import { AppComponent } from './app.component';


@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    FormsModule,
    HttpModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
``` 

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

proxy/default.conf

```sh
# web service1 config.
server {
  listen 80 default_server;
  listen [::]:80 default_server;
  server_name _;
  # return 301 https://$host$request_uri;

  client_max_body_size 100M;

  index index.js index.htm index.html;

  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_buffering off;
  proxy_request_buffering off;
  proxy_intercept_errors on;

  # HTTP 1.1 support
  proxy_http_version 1.1;
  proxy_set_header Connection "";

  location / {
    proxy_pass "http://angular:4200";
  }
}
```

Änderungen am `docker-compose.yml`-File sind auch nötig, do dass zum Einen nicht bei jeder Änderung an einem Angular-File der komplette Container neu gebaut werden muss (dazu dient das Volume im "angular"-Container) und dass zum Anderen der Proxy-Container angelegt und mit dem Client verknüpft wird.  

```sh
version: '3'

services:
  angular: 
    build: ng4-client
    volumes: 
      - ./ng4-client:/ng-app 
    ports:
      - "4200:4200"

  server: 
    build: server 
    ports:
      - "3000:3000" 
    links: 
      - database  

  database: 
    image: mongo 
    ports:
      - "27017:27017" 

  proxy:
    build: proxy
    restart: always
    ports:
      - 80:80
    links: 
      - angular
```