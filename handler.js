'use strict';

const {Storage} = require('@google-cloud/storage');
const storage = new Storage();
const childProcess = require("child_process");
const fs = require("fs");
const path = require("path");
const async = require("async");
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const os = require('os');
app.use(bodyParser.json());

const apiTimeout = 900 * 1000;
app.use((req, res, next) => {
    req.setTimeout(apiTimeout, () => {
        let err = new Error('Request Timeout');
        err.status = 408;
        next(err);
    });
    res.setTimeout(apiTimeout, () => {
        let err = new Error('Service Unavailable');
        err.status = 503;
        next(err);
    });
    next();
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
    console.log("Listening on port", port);
});

app.post("/", (req, res) => {

    console.log(os.cpus());

    const request = req.body;

    const metrics = {
        "containerStart": Date.now()
    };

    const executable = request.executable;
    const args = request.args;
    const bucket_name = request.options.bucket;
    const prefix = request.options.prefix;
    const inputs = request.inputs.map(input => input.name);
    const outputs = request.outputs.map(output => output.name);
    const files = inputs.slice();
    files.push(executable);

    console.log("Executable: " + executable);
    console.log("Arguments:  " + args);
    console.log("Inputs:     " + inputs);
    console.log("Outputs:    " + outputs);
    console.log("Bucket:     " + bucket_name);
    console.log("Prefix:     " + prefix);
    console.log("Stdout:     " + request.stdout);

    async.waterfall([
        download,
        execute,
        upload,
        clearTmpDir
    ], async function (err) {
        if (err) {
            console.error("Error: " + err);
            res.status(500).send('Bad Request: ' + err);
        } else {
            console.log("Success");
            metrics.containerEnd = Date.now();
            const metricsString = "container start: " + metrics.containerStart + " container end: " + metrics.containerEnd +
                " download start: " + metrics.downloadStart + " download end: " + metrics.downloadEnd +
                " execution start: " + metrics.executionStart + " execution end: " + metrics.executionEnd +
                " upload start: " + metrics.uploadStart + " upload end: " + metrics.uploadEnd;
            res.status(200).send(metricsString);
        }
    });

    function clearTmpDir(callback) {
        fs.readdir("/tmp", (err, files) => {
            if (err) throw err;
            for (const file of files) {
                fs.unlink(path.join("/tmp", file), () => {

                });
            }
        });
        callback();
    }

    function download(callback) {
        metrics.downloadStart = Date.now();
        async.each(files, function (file, callback) {

            let file_cloud_path = bucket_name + "/" + prefix + "/" + file;
            console.log("Downloading " + file_cloud_path);

            storage.bucket(bucket_name).file(prefix + "/" + file).download({
                destination: '/tmp/' + file
            }, function (err) {
                if (err) {
                    console.error("Error downloading file " + file_cloud_path);
                    console.error(err);
                    callback(err)
                } else {
                    console.log("Downloaded file " + file_cloud_path);
                    callback();
                }
            });
        }, function (err) {
            metrics.downloadEnd = Date.now();
            if (err) {
                console.error("Failed to download file:" + err);
                callback(err)
            } else {
                console.log("All files have been downloaded successfully");
                callback()
            }
        });
    }

    function execute(callback) {
        metrics.executionStart = Date.now();
        const proc_name = "/tmp/" + executable;
        fs.chmodSync(proc_name, "777");

        let proc;
        console.log("Running executable" + proc_name);


        proc = childProcess.spawn(proc_name, args, {cwd: "/tmp"});

        proc.stdout.on("data", function (exedata) {
            console.log("Stdout: " + executable + exedata);
        });

        proc.stderr.on("data", function (exedata) {
            console.log("Stderr: " + executable + exedata);
        });

        if (request.stdout) {
            let stdoutStream = fs.createWriteStream("/tmp" + "/" + request.stdout, {flags: 'w'});
            proc.stdout.pipe(stdoutStream);
        }

        proc.on("error", function (code) {
            console.error("Error!!" + executable + JSON.stringify(code));
        });
        proc.on("exit", function () {
            console.log("My exe exit " + executable);
        });

        proc.on("close", function (code) {
            console.log("My exe close " + executable);
            if (code !== 0) {
                callback(`Got exit code ${code} from ${executable}`)
            } else {
                metrics.executionEnd = Date.now();
                callback();
            }
        });
    }

    function upload(callback) {
        metrics.uploadStart = Date.now();
        async.each(outputs, function (file, callback) {

            let file_cloud_path = bucket_name + "/" + prefix + "/" + file;
            console.log("Uploading " + file_cloud_path);

            storage.bucket(bucket_name).upload('/tmp/' + file, {destination: prefix + "/" + file}, function (err) {
                if (err) {
                    console.error("Error uploading file " + file_cloud_path);
                    console.error(err);
                    callback(err);
                } else {
                    console.log("Uploaded file " + file_cloud_path);
                    callback();
                }
            });
        }, function (err) {
            metrics.uploadEnd = Date.now();
            if (err) {
                console.log("Error uploading file " + err);
                callback(err);
            } else {
                console.log("All files have been uploaded successfully");
                callback()
            }
        });
    }
});