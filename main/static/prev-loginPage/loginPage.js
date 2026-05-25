const loginForm = document.getElementById("loginForm");
const signupForm = document.getElementById("signupForm");
const submitLogin = document.getElementById("login-btn");
const submitSignup = document.getElementById("signup-btn");

// LOGINSYSTEM
submitLogin.addEventListener("click", (e) => {
    e.preventDefault(); // ts will prevent the page from refreshing
    
    const loginData = new FormData(loginForm);
    
    console.log(loginData.get("email")); 
    console.log(loginData.get("password"));
    alert(
        `Email: ${loginData.get("email")}\n
        Password: ${loginData.get("password")}`
    );
});


// SIGNUP SYSTEM
submitSignup.addEventListener("click", (e) => {
    e.preventDefault(); // ts will prevent the page from refreshing
    
    const signupData = new FormData(signupForm);
    
    console.log(signupData.get("username"));
    console.log(signupData.get("email"));
    console.log(signupData.get("password"));
    alert(
        `Username: ${signupData.get("username")}\n
        Email: ${signupData.get("email")}\n
        Password: ${signupData.get("password")}`
    );
});