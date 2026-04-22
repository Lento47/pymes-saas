const data = {
  email: "owner@demo.com",
  password: "Owner1234!"
};

fetch("http://localhost:4000/api/auth/login", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-workspace-slug": "demo-workspace"
  },
  body: JSON.stringify(data)
})
  .then(res => res.json().then(json => ({ status: res.status, json })))
  .then(({ status, json }) => {
    console.log("Status:", status);
    console.log("Response:", JSON.stringify(json, null, 2));
  })
  .catch(err => console.error("Error:", err));
