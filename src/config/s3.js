const AWS = require("aws-sdk");

const region = process.env.AWS_REGION || "id-jkt-1";

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: region,
});

let endpoint = process.env.AWS_S3_ENDPOINT || "https://is3.cloudhost.id";

if (endpoint) {
  endpoint = endpoint.replace(/['"\s]+/g, '');

  endpoint = endpoint.replace(/^[a-zA-Z]+:\/\//, '');

  endpoint = `https://${endpoint}`;
}

const s3 = new AWS.S3({
  endpoint: endpoint,
  s3BucketEndpoint: false,
  s3ForcePathStyle: true,
  signatureVersion: "v4",
  maxRetries: 3,
  httpOptions: {
    timeout: 30000,
    connectTimeout: 5000
  },
  retryDelayOptions: {
    base: 300
  }
});

const bucketName = process.env.AWS_S3_BUCKET_NAME || "rumahistimewa";

module.exports = { s3, bucketName };
