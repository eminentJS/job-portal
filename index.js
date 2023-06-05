require('dotenv').config()
const express = require('express')  // import express
const app = express()  // create express app
const bodyParser = require('body-parser')   // import body-parser



app.use(bodyParser.json())  // use bodyParser middleware
app.listen(process.env.PORT, () => {  
    console.log(`Server is running on port ${process.env.PORT}`)
    }       
)

