# hyperflow-cloudrun-executor

To use this executor build container image and deploy it to Cloud Run platfdorm.
Useful links:
https://cloud.google.com/run/docs/quickstarts/build-and-deploy
https://cloud.google.com/run/docs/deploying

After deploying you will get a url at which the executor is available. 
HyperFlow should send requests to that url, just like in cloud functions.