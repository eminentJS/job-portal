require('dotenv').config()  // import dotenv
const express = require('express')  // import express
const app = express()  // create express app
const bodyParser = require('body-parser')   // import body-parser
const joi = require('joi')  // import joi
const {v4: uuidv4} = require('uuid')  // import uuid
const sendGrid = require('@sendgrid/mail')  // import sendgrid
sendGrid.setApiKey(process.env.SENDGRID_API_KEY);

let customerStore = [
    // {
    //     id:
    //     lastname:
    //     firstname:
    //     email:
    //     phone:
    //     password:
    //     registeredData:
    // }
]
const otpStore = [
    // {
    //     id: 1,
    //     otp:
    //     email: 
    //     date:
    // }
]

app.use(bodyParser.json())  // use bodyParser middleware

app.get('/', (req, res) => {
    res.status(200).json({
        status: true,
        message: 'Welcome to my API'
    })
})

app.post('/register', (req, res) => {

    const { lastname, firstname, email, phone, password } = req.body

    const registerSchema = joi.object({     // create a schema
        lastname: joi.string().required().min(3),
        firstname: joi.string().required(), 
        email: joi.string().email().required(),     
        phone: joi.string().required(),      
        password: joi.string().required()
    })

    const { value, error } = registerSchema.validate(req.body) // validate the request body against the schema
    if (error != undefined) {       // if error is not undefined, then return the error
        res.status(400).json({
            status: false, 
            message: error.details[0].message
        })

       return
    }


    const isEmailOrPhoneRegistered = customerStore.find(customer => customer.email === email || customer.phone === phone)   // check if email or phone is already registered
    if (isEmailOrPhoneRegistered) {
        res.status(400).json({
            status: false,
            message: 'Email or phone already registered'
        })
        return
    }

    const customer = {
                id: uuidv4(),
                lastname,
                firstname,
                email,
                phone,
                password,
                status: 'in-active',
                registeredDate: new Date()
    }   

    customerStore.push(customer)    // push customer to customerStore

    const otp =  generateOtp ()   // generate otp
    const tempOtp = {
        id: uuidv4(),
        otp,
        email,
        date: new Date()
    }

    
    
    otpStore.push(tempOtp)  // push otp to otpStore
    // send otp to customer email
    sendEmail(email, 'OTP Verification', `Hi ${firstname}, Your OTP is ${otp}. Kindly note that this OTP expires in 5 minutes.`)
   
 
    res.status(201).json({    // return success response
        status: true,
        message: 'An OTP has been sent to your email, use that to complete your registration.',
        data: customerStore
    })

})


app.get('/verify/:email/:otp', (req, res) => {
    const { email, otp } = req.params
    if (!email || !otp) {                       // check if email or otp is not provided
        res.status(400).json({                  // return error response    
            status: false,
            message: 'Email and OTP is required'
        })
        return  
    }


    const customer = otpStore.find(data => data.email === email && data.otp == otp)  // get customer
    
    if (!customer) {                             // check if customer is not found       
        res.status(400).json({                   // return error response
            status: false,
            message: 'Invalid OTP',
            customer: customer 
        })
        return
    }   
    // check if otp has expired
    const timeDifference = new Date() - new Date(customer.date)     // get the difference between the current date and the date the otp was generated   
    const timeDifferenceInMinutes = Math.ceil(timeDifference / (1000 * 60))     // convert the difference to minutes    
    if (timeDifferenceInMinutes > 5) {      
        res.status(400).json({                
            status: false,
            message: 'OTP has expired'
        })
        return  
    }

    const newCustomerStore = customerStore.map(data =>{              // remove customer from customerStore
        if (data.email === email) { 
            data.status = 'active'
        }
    
    })

    customerStore = [...newCustomerStore]

    res.status(200).json({                      // return success response
        status: true,
        message: 'OTP verified successfully',
        data: customerStore
    })  

})


app.get('resend-otp/:email', (req, res) => {
    const { email } = req.params
    if (!email) {                       // check if email or otp is not provided
        res.status(400).json({                  // return error response    
            status: false,
            message: 'Email is required'
        })
        return  
    }

    const customer = customerStore.find(data => data.email === email)           // get customer
    if (!customer) {                             // check if customer is not found  
        res.status(400).json({                   // return error response
            status: false,
            message: 'Invalid email'
        })
        return
    }
    const otp = generateOtp()   // generate otp
    const tempOtp = {
        id: uuidv4(),   
        otp,
        email,
        date: new Date()
    }
    otpStore.push(tempOtp)  // push otp to otpStore
    // send otp to customer email
    sendEmail(email, 'Resend OTP', `Hi ${firstname}, Your new OTP is ${otp}.`)

    res.status(200).json({                      // return success response  
        status: true,
        message: "OTP resent successfully"
    })
})


app.get('/customers', (req, res) => {

    const { apikey } = req.headers  // get apiKey from request headers
    if (!apikey || apikey !== process.env.API_KEY ) {    // check if apiKey is not provided or is not equal to the one in the .env file
        res.status(401).json({      // return error response
            status: false,                                          
            message: 'Unauthorized'
        })  
        return
    }


    res.status(200).json({          // return success response  
        status: true,
        data: customerStore
    })
})





const generateOtp = () => {
    return Math.floor(100000 + Math.random() * 900000)  // generate 6 digit random number
}

const sendEmail = (email, subject, message) => {
    const msg = {
    to: email,
    from: process.env.EMAIL_SENDER, // Use the email address or domain you verified above
    subject: subject,
    text: message,
  };
sendGrid
    .send(msg)
    .then(() => { })                          // return success response 
    .catch((error) => { })                     // return error response   

}





app.listen(process.env.PORT, () => {

    console.log(`Server is running on port ${process.env.PORT}`)
    }       
)

