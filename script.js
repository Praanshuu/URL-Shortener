const API_BASE_URL = "http://localhost:8001/url"; // Change this if backend is deployed

// Get references to DOM elements
const linksTableBody = document.getElementById('links-table-body');
const shortenButton = document.querySelector('.btn-shorten');
const linkInput = document.querySelector('.link-input');
const toggleSwitch = document.querySelector('.toggle input');

// Function to shorten a URL via backend
async function shortenLink() {
    const originalLink = linkInput.value.trim();
    if (!originalLink) {
        alert("Please enter a valid URL.");
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: originalLink }),
        });

        const data = await response.json();

        if (data.id) {
            const shortUrl = `http://localhost:8001/url/${data.id}`;
        
            document.querySelector("#shortened-link").innerHTML = 
                `<a href="${shortUrl}" target="_blank">${shortUrl}</a>`;
        
            // ✅ Immediately add the new URL to the table without refreshing
            addLinkToTable(originalLink, shortUrl, "custom", 0, "Active", new Date().toLocaleDateString());
        
            linkInput.value = "";
        }
         else {
            alert("Error: " + data.error);
        }

    } catch (error) {
        console.error("Error shortening URL:", error);
        alert("Failed to shorten URL. Please try again.");
    }
}



// Function to fetch analytics from backend
async function fetchAnalytics(shortId) {
    try {
        const response = await fetch(`${API_BASE_URL}/analytics/${shortId}`);
        const data = await response.json();

        if (data.error) {
            alert("Error: " + data.error);
        } else {
            alert(`Total Clicks: ${data.totalClicks}`);
        }
    } catch (error) {
        console.error("Error fetching analytics:", error);
        alert("Failed to fetch analytics.");
    }
}

// Function to populate links table dynamically
async function populateLinksTable() {
    try {
        linksTableBody.innerHTML = ""; // Clear table before loading data

        // ✅ Ensure this is a GET request
        const response = await fetch(`${API_BASE_URL}/all`, {
            method: "GET",
            headers: { "Content-Type": "application/json" }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();

        data.forEach(link => {
            addLinkToTable(
                link.redirectURL, 
                `http://localhost:8001/url/${link.shortId}`,  // ✅ This ensures correct links always
                "custom", 
                link.visitHistory.length, 
                "Active", 
                new Date(link.createdAt).toLocaleDateString()
            );            
        });
    } catch (error) {
        console.error("❌ Error fetching links:", error);
        alert("Failed to load links. See console for details.");
    }
}




// Function to add a row to the table
function addLinkToTable(originalLink, shortLink, platform, clicks, status, date) {
    const row = document.createElement("tr");
    row.innerHTML = `
        <td>${platform}</td>
        <td><a href="${shortLink}" target="_blank">${shortLink}</a></td>
        <td>${clicks}</td>
        <td>${status}</td>
        <td>${date}</td>
        <td><button class="analytics-btn" data-shortid="${shortLink.split('/').pop()}">📊</button></td>
    `;
    linksTableBody.appendChild(row);

    // ✅ Add event listener for analytics button
    row.querySelector(".analytics-btn").addEventListener("click", function () {
        fetchAnalytics(this.dataset.shortid);
    });
}


// Event listener for shortening a link
shortenButton.addEventListener("click", shortenLink);

// Toggle functionality
toggleSwitch.addEventListener("change", function () {
    document.body.classList.toggle("dark-mode", this.checked);
});

// Load existing links on page load
document.addEventListener("DOMContentLoaded", populateLinksTable);
