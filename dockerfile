from ubuntu:latest
RUN apt-get update
RUN apt-get install node npm
ADD . .
