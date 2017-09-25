from ubuntu:latest
RUN apt-get update
RUN apt-get install -y build-essential checkinstall libssl-dev curl
RUN curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.31.0/install.sh | bash
RUN nvm install 8.5.0
RUN nvm use 8.5.0
RUN nvm alias latest node
RUN node -v
RUN npm -v
