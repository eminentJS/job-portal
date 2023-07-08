const authorization = (apikey) => {

    if (!apikey || apikey !== process.env.API_KEY) {  // check if apiKey is not provided or is not equal to the one in the .env file   
        return false
    }
    return true

}

module.exports = authorization