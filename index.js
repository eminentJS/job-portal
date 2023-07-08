require('dotenv').config()  // import dotenv
const express = require('express')  // import express
const app = express()  // create express app
const bodyParser = require('body-parser')   // import body-parser
const joi = require('joi')  // import joi
const {v4: uuidv4} = require('uuid')  // import uuid
const sendGrid = require('@sendgrid/mail')  // import sendgrid
sendGrid.setApiKey(process.env.SENDGRID_API_KEY);
const bcrypt = require('bcrypt');
const saltRounds = 10;
const axios = require('axios')
const authorization = require('./authorization')  // import authorization middleware

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

app.post('/register', async (req, res) => {

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
    
    const responseSalt = await bcrypt.genSalt(saltRounds)      // generate salt
    if (!responseSalt) {
        res.status(500).json({
            status: false,
            message: 'Sorry, we cannot create account at the moment. Please try again later.'
        })
        return
    }
    const responseHash = await bcrypt.hash(password, responseSalt)      // hash password
    if (!responseHash) {            
        res.status(500).json({
            status: false,
            message: 'Sorry, we cannot create account at the moment. Please try again later.'
        })
        return
    }


    const customer = {
                id: uuidv4(),
                lastname,
                firstname,
                email,
                phone,
                password: responseHash,
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


app.get('/verify/:email/:otp', async(req, res) => {
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
    sendEmail(email, 'Registration Successful', `Hi, we are happy to have you onboard. Let's do some awesome stuffs together`)   // send email to customer
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


app.post('/login', async (req, res) => {

    const { emailOrPhone, password } = req.body    

    const loginSchema = joi.object({     // define login schema using joi
        emailOrPhone: joi.string().required(),
        password: joi.string().required()
    }) 

    const { value, error } = loginSchema.validate(req.body)   // validate request body
    if (error != undefined) {                                                // check if there is an error  
        res.status(400).json({                                              // return error response    
            status: false,  
            message: error.details[0].message
        })
        return
    }

    const customer = customerStore.find(data => data.email === emailOrPhone || data.phone === emailOrPhone)  // get customer
    if (!customer) {                             // check if customer is not found
        res.status(400).json({                   // return error response
            status: false,
            message: 'Invalid email or password'
        })
        return
    }
    
    const responseHash = await bcrypt.hash(password, customer.salt)  // hash password with user salt
    if (!responseHash) {                    // check if responseHash is not found
        res.status(500).json({             // return error response
            status: false,
            message: 'Sorry, you cannot login this time. Please try again later'
        })
        return
    }

    if (responseHash !== customer.password) {  // check if responseHash is not equal to userHashWithUs
        res.status(400).json({                 // return error response
            status: false,
            message: 'Invalid email or password'
        })
        return
    }

    if (customer.status !== 'active') {  // check if customer status is not active
        res.status(400).json({                 // return error response
            status: false,
            message: 'Account not verified, kindly verify your account'
        })
        return
    }

    res.status(200).json({                      // return success response
        status: true,
        message: 'Login successful'
    })
})



app.get('/jobs', async(req, res) => {

    const { apikey } = req.headers  // get apiKey from request headers
    const length = req.query.length  || 10  // get length from request query
    const category = req.query.category || ''  // get category from request query
    const company = req.query.company || ''  // get company from request query

    const response = authorization(apikey)  // check if apiKey is valid
    if (!response) {                 // check if apiKey is not valid
        res.status(401).json({              // return error response
            status: false,
            message: 'Unathorisized'
        })
        return
    }

    const result =await axios({
        method:  "get",
        url: `${process.env.REMOTE_API_BASEURL}/remote-jobs?limit=${length}&category=${category}&company_name=${company}`
    })           

    res.status(200).json({                      // return success response
        status: true,
        count: result.data.jobs.length,
        data: result.data.jobs
    })
   
    
    // fetch('https://remotive.com/api/remote-jobs')  // fetch jobs from remotive api
    // .then(response => response.json())
    // .then(data => {
    //     res.status(200).json({                      // return success response
    //         status: true,
    //         data: data.jobs
    //     })
    // })

})


app.get('/jobs/categories', async(req, res) => {
    
    const result = await axios({
        method: "get",
        url: `${process.env.REMOTE_API_BASEURL}/remote-jobs`
    })

    
    // const response1 = await axios({
    //     method: "get",
    //     url: "https://remotive.com/api/remote-jobs",
    // })

    const jobCategories = result.data.jobs.map(item => item.category)

   res.status(200).json({                      // return success response
        status: true,
        data: jobCategories
   })





    


})
    










app.post('/job/apply', (req, res) => {
    const applySchema = joi.object({     // define apply schema using joi
        fullname: joi.string().required().min(4),
        address: joi.string().required().min(10),
        email: joi.string().required().email(),
        jobId: joi.string().required(),
        yearsOfExperience: joi.number().required(),
        qualifications: joi.string().required().valid('SSCE', 'BSC', 'MSC')
    })

    const { value, error } = applySchema.validate(req.body)   // validate request body
    if (error !== undefined) {                                                // check if there is an error
        res.status(400).json({                                              // return error response
            status: false,
            message: error.details[0].message
        })
        return
    }


    const { fullname, address, email, jobId, yearsOfExperience, qualifications } = req.body  // get request body
    const job = {
        id: uuidv4(),
        fullname,
        address,
        email,
        jobId,
        yearsOfExperience,
        qualifications,
        status: 'submitted',
        date: new Date()
    }

    jobApplicationStore.push(job)  // add job to jobApplicationStore
    
    res.status(200).json({          // return success response
        status: true,
        message: 'Job application submitted successfully'

    })
})

const jobApplicationStore = []





app.get('/admin/customers', (req, res) => {

    const { apikey } = req.headers  // get apiKey from request headers
    const response = authorization(apikey)  // check if apiKey is valid
    if (!response) {                 // check if apiKey is not valid
        res.status(401).json({              // return error response
            status: false,
            message: 'Unathorisized'
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

