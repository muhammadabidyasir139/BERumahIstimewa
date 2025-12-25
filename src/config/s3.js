const AWS = require("aws-sdk");

const s3 = new AWS.S3({
  accessKeyId: "OIIJ8HVEKMLWAL7VSRC7",
  secretAccessKey: "Zg3OA3uDCFdmRSewggB0xj2j8sHlVZlt2FwEJ7wJ",
  endpoint: "https://is3.cloudhost.id",
  s3BucketEndpoint: true,
  s3ForcePathStyle: true,
  region: "us-east-1", // or whatever region
});

const bucketName = "rumahistimewa";

module.exports = { s3, bucketName };
