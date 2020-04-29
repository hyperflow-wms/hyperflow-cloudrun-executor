FROM fedora:25

RUN curl -sL https://rpm.nodesource.com/setup_8.x | bash -
RUN dnf -y install nodejs

RUN dnf -y update && dnf clean all
RUN dnf -y --setopt=install_weak_deps=False --best install \
	lapack \
	gcc-gfortran \
	libstdc++ \
	openblas \
	&& dnf clean all
		
WORKDIR /home

ADD libmixmod-fedora25.tar.gz /lib64
ADD gsl-2.4-7.fc29.x86_64.rpm /
RUN dnf -y install /gsl-2.4-7.fc29.x86_64.rpm

COPY . .
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . .
CMD [ "npm", "start" ]