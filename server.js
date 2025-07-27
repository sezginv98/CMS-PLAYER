const express = require('express');
const path = require('path');

const app = express();
app.use(express.static(path.join(__dirname, 'media')));

app.listen(3000, () => {
  console.log('Media server running on http://localhost:3000');
});