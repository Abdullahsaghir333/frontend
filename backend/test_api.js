const http = require('http');

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/auth/signup',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
};

const req = http.request(options, res => {
  console.log(`STATUS: ${res.statusCode}`);
  res.setEncoding('utf8');
  res.on('data', chunk => {
    console.log(`BODY: ${chunk}`);
  });
});

req.on('error', e => {
  console.error(`Problem with request: ${e.message}`);
});

req.write(JSON.stringify({
  name: "Test User",
  email: "test@example.com",
  password: "password123"
}));

req.end();
