FROM nginx:alpine

#  default conf for proxy service
RUN rm /etc/nginx/conf.d/default.conf
COPY ./default.conf /etc/nginx/conf.d/default.conf
## COPY ./temp/* /var/www/.well-known/acme-challenge/

# NOT FOUND response
# COPY ./backend-not-found.html /var/www/html/backend-not-found.html

#  Proxy and SSL configurations
# COPY ./includes/ /etc/nginx/includes/

# Proxy SSL certificates
## COPY ./ssl/ /etc/ssl/certs/nginx/