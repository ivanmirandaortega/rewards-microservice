const express = require('express');
const cors = require('cors');

const app = express();

app.get('/', (req, res) => {
	res.send('rewards microservice test');
});

app.listen(3000, () => {
	console.log(`Server running on http://localhost:3000`);
});
