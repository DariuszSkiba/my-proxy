// src/index.js
document.getElementById('start-camera-btn').addEventListener('click', function() {
    document.getElementById('upload-list').click();
});

document.getElementById('upload-list').addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const imageUrl = e.target.result;
            readBarcodeFromImage(imageUrl);
        };
        reader.readAsDataURL(file);
    }
});

document.getElementById('manual-submit-btn').addEventListener('click', function() {
    const manualCode = document.getElementById('manual-code').value;
    if (manualCode) {
        fetchProductInfo(manualCode);
        document.getElementById('manual-code').value = ''; // Clear the text field
    } else {
        console.error("Please enter a valid barcode.");
    }
});

function readBarcodeFromImage(imageUrl) {
    Quagga.decodeSingle({
        src: imageUrl,
        numOfWorkers: 0,
        inputStream: {
            size: 800 
        },
        decoder: {
            readers: [
                "ean_reader", 
                "ean_8_reader", 
                "code_128_reader", 
                "code_39_reader", 
                "code_93_reader", 
                "upc_reader", 
                "upc_e_reader", 
                "i2of5_reader", 
                "codabar_reader"
            ]
        },
        locate: true, 
        locator: {
            patchSize: "medium",
            halfSample: false
        }
    }, function(result) {
        if (result && result.codeResult) {
            fetchProductInfo(result.codeResult.code);
        } else {
            console.error("No barcode detected.");
            readQRCodeFromImage(imageUrl);
        }
    }, function(error) {
        console.error("Error reading barcode: ", error);
        readQRCodeFromImage(imageUrl);
    });
}

function readQRCodeFromImage(imageUrl) {
    const img = new Image();
    img.src = imageUrl;
    img.crossOrigin = "Anonymous";
    img.onload = function() {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        context.drawImage(img, 0, 0, img.width, img.height);

        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        console.log("Image Data:", imageData);
        
        const qrCode = jsQR(imageData.data, imageData.width, imageData.height);
        if (qrCode) {
            addBarcodeToList(qrCode.data, "QR Code");
            console.log("QR code detected:", qrCode.data);
        } else {
            console.error("No QR code detected.");
        }
    };
    img.onerror = function() {
        console.error("Error loading image for QR code decoding.");
    };
}

function fetchProductInfo(barcode) {
    fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`)
        .then(response => response.json())
        .then(data => {
            console.log("Fetched data:", data);
            if (data.status === 1 && data.product.product_name) {
                const productName = data.product.product_name;
                console.log("Product name found:", productName);
                addBarcodeToList(barcode, productName);
            } else {
                console.error("Product not found in database or product name is empty.");
                addBarcodeToList(barcode, "Unknown Product");
            }
        })
        .catch(error => {
            console.error("Error fetching product info:", error);
            addBarcodeToList(barcode, "Unknown Product");
        });
}

function addBarcodeToList(barcode, productName) {
    const barcodeList = document.getElementById('barcode-list');
    const li = document.createElement('li');
    li.textContent = `${productName} (${barcode})`;

    const quantityInput = document.createElement('input');
    quantityInput.type = 'number';
    quantityInput.value = 1;
    quantityInput.classList.add('quantity-input');

    const removeBtn = document.createElement('span');
    removeBtn.textContent = 'Remove';
    removeBtn.classList.add('remove-btn');
    removeBtn.addEventListener('click', function() {
        barcodeList.removeChild(li);
    });

    const editBtn = document.createElement('span');
    editBtn.textContent = 'Edit';
    editBtn.classList.add('edit-btn');
    editBtn.addEventListener('click', function() {
        const newProductName = prompt("Enter new product name:", productName);
        if (newProductName) {
            li.textContent = `${newProductName} (${barcode})`;
            li.appendChild(quantityInput);
            li.appendChild(removeBtn);
            li.appendChild(editBtn);
        }
    });
    li.appendChild(quantityInput);
    li.appendChild(removeBtn);
    li.appendChild(editBtn);
    barcodeList.appendChild(li);

    console.log("Added to list:", productName, barcode);
}

// Load API client library
gapi.load('client:auth2', initClient);

function initClient() {
    gapi.client.init({
        apiKey: process.env.GOOGLE_API_KEY,
        clientId: process.env.CLIENT_ID,
        discoveryDocs: ["https://sheets.googleapis.com/$discovery/rest?version=v4"],
        scope: "https://www.googleapis.com/auth/spreadsheets"
    }).then(function () {
        document.getElementById('submit-data-btn').addEventListener('click', handleAuthClick);
    });
}

function handleAuthClick(event) {
    gapi.auth2.getAuthInstance().signIn().then(sendDataToSheet);
}

function sendDataToSheet() {
    const barcodeList = document.querySelectorAll('#barcode-list li');
    const dataToSend = [];

    barcodeList.forEach((item, index) => {
        const name = item.childNodes[0].textContent;
        const quantity = item.querySelector('.quantity-input').value;
        const barcode = name.match(/\(([^)]+)\)/)[1];
        const scannedDate = new Date().toISOString();

        dataToSend.push([index + 1, name.split(' (')[0], quantity, barcode, scannedDate, '']);
    });

    const params = {
        spreadsheetId: process.env.SPREADSHEET_ID,
        range: 'scaned_products!A:F',
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS'
    };

    const valueRangeBody = {
        values: dataToSend
    };

    gapi.client.sheets.spreadsheets.values.append(params, valueRangeBody).then((response) => {
        console.log(response);
        alert('Data successfully submitted!');
    }, (error) => {
        console.error(error);
        alert('Error submitting data.');
    });
}
