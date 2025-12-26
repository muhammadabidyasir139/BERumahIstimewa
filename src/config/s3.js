const AWS = require("aws-sdk");

// Debug logging for environment variables
console.log("S3 Config - AWS_S3_ENDPOINT:", process.env.AWS_S3_ENDPOINT);
console.log("S3 Config - AWS_S3_BUCKET_NAME:", process.env.AWS_S3_BUCKET_NAME);

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || "us-east-1",
});

const endpoint = process.env.AWS_S3_ENDPOINT || "https://is3.cloudhost.id";
console.log("S3 Config - Using endpoint:", endpoint);

const s3 = new AWS.S3({
  endpoint: endpoint,
  s3BucketEndpoint: true,
  s3ForcePathStyle: true,
  signatureVersion: "v4",
});

const bucketName = process.env.AWS_S3_BUCKET_NAME || "rumahistimewa";
console.log("S3 Config - Using bucket:", bucketName);

module.exports = { s3, bucketName };
