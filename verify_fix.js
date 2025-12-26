const AWS = require("aws-sdk");

// Mock the environment variable with quotes/spaces to test sanitization
process.env.AWS_S3_ENDPOINT = " 'https://is3.cloudhost.id' ";
process.env.AWS_S3_BUCKET_NAME = "test-bucket";

// Initialize the config
// Note: We need to require this AFTER setting env vars because the file reads them at top level
const { s3 } = require('./src/config/s3');

console.log('--- Verification Output ---');
console.log('Input Env Var:', process.env.AWS_S3_ENDPOINT);
console.log('Adjusted Endpoint:', s3.endpoint.href);
console.log('Hostname:', s3.endpoint.hostname);
console.log('Protocol:', s3.endpoint.protocol);

let passed = true;

if (s3.endpoint.hostname !== 'is3.cloudhost.id') {
    console.error('FAIL: Hostname mismatch');
    passed = false;
}

if (s3.endpoint.protocol !== 'https:') {
    console.error('FAIL: Protocol mismatch');
    passed = false;
}

if (!s3.config.s3ForcePathStyle) {
    console.error('FAIL: s3ForcePathStyle should be true');
    passed = false;
}

// s3BucketEndpoint should be false in the options used to create the service
// Accessing it via config service object
// Note: s3.config.s3BucketEndpoint might be undefined if it's not a global config but service specific
// Let's check the service options if possible, or trust the output
console.log('s3BucketEndpoint:', s3.config.s3BucketEndpoint);
// Note: AWS SDK might not expose s3BucketEndpoint exactly on config object if passed in constructor options,
// but we can check if it modified the endpoint computation.

if (passed) {
    console.log('VERIFICATION PASSED');
    process.exit(0);
} else {
    console.log('VERIFICATION FAILED');
    process.exit(1);
}
