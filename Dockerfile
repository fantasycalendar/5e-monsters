# syntax=docker/dockerfile:1

FROM node:lts-fermium
# Sometimes lts-fermium npm is slow, switching to 14.17.5 actually improves speed...

ENV NODE_ENV=production

# Create app directory
WORKDIR /workspaces/scaled-encounters

# Expose port to be mapped by docker daemon
EXPOSE 8080

# Install dependencies
COPY ["package.json", "package-lock.json", "./"]
RUN npm config set registry https://registry.npmjs.org/ && npm install --production

# Bundle app source inside docker image
COPY . .

# Default command to run when container starts
CMD ["npm", "start"]