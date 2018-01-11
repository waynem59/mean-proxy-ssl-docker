FROM nginx:alpine

#  default conf for proxy service
RUN rm /etc/nginx/conf.d/default.conf
COPY ./default.conf /etc/nginx/conf.d/default.conf
COPY ./certs/ /root/certs/