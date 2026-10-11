# Photo Moment · Abi & Puput

Website sederhana untuk menangkap momen foto di hari pernikahan.

## Fitur

- **Ambil Foto** — akses kamera depan/belakang, ambil foto langsung dari browser
- **Upload Foto** — pilih dari galeri HP / seret file
- **Galeri Lokal** — semua foto yang diambil/diupload di perangkat ini tersimpan di IndexedDB (tetap ada meski refresh)
- Link langsung ke folder Google Drive bersama:  
  https://drive.google.com/drive/folders/1T9cY5FAOQHv8Axvu1--CEijVpb_uXyR6

## Cara Pakai (Tamu)

1. Buka website di HP (disarankan Chrome / Safari)
2. Izinkan akses kamera
3. Ambil foto atau upload dari galeri
4. Foto tersimpan di galeri website
5. Klik "Buka Folder Google Drive" lalu upload foto ke folder tersebut (drag & drop atau tombol New → File upload)

## Cara Deploy Website

### Opsi 1: GitHub Pages (gratis)
1. Buat repo baru di GitHub
2. Upload file `index.html`, `style.css`, `script.js`
3. Settings → Pages → Source: main branch
4. Website hidup di `https://username.github.io/nama-repo`

### Opsi 2: Netlify / Vercel
- Drag & drop folder ke netlify.com/drop atau vercel.com

### Opsi 3: Google Drive sendiri
- Upload ketiga file ke folder Google Drive
- Klik kanan `index.html` → Open with → Google Drive viewer (kurang ideal)
- Lebih baik pakai hosting statis di atas

---

## Upload Otomatis ke Google Drive (Opsional – Recommended)

Agar tamu **tidak perlu** upload manual, buat **Google Apps Script** sebagai backend:

### Langkah-langkah:

1. Buka [script.google.com](https://script.google.com) → New project
2. Ganti kode default dengan:

```javascript
function doPost(e) {
  try {
    const folderId = '1T9cY5FAOQHv8Axvu1--CEijVpb_uXyR6'; // folder wedding
    const data = JSON.parse(e.postData.contents);
    
    const blob = Utilities.newBlob(
      Utilities.base64Decode(data.data),
      data.mimeType || 'image/jpeg',
      data.filename || ('photo_' + new Date().getTime() + '.jpg')
    );
    
    const folder = DriveApp.getFolderById(folderId);
    const file = folder.createFile(blob);
    
    // Opsional: buat file bisa dilihat siapa saja
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    return ContentService
      .createTextOutput(JSON.stringify({
        success: true,
        fileId: file.getId(),
        url: file.getUrl(),
        webViewLink: 'https://drive.google.com/file/d/' + file.getId() + '/view'
      }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'Photo Moment Upload API ready' }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

3. Klik **Deploy** → **New deployment**
4. Type: **Web app**
5. Execute as: **Me**
6. Who has access: **Anyone**
7. Deploy → copy **Web app URL** (bentuknya `https://script.google.com/macros/s/XXXX/exec`)

8. Di file `script.js`, ganti fungsi `saveToGallery` atau tambahkan fungsi upload otomatis:

```javascript
async function uploadToDrive(blob, filename) {
  const reader = new FileReader();
  return new Promise((resolve, reject) => {
    reader.onload = async () => {
      const base64 = reader.result.split(',')[1];
      try {
        const res = await fetch('https://script.google.com/macros/s/XXXX/exec', { // ganti XXXX
          method: 'POST',
          body: JSON.stringify({
            data: base64,
            filename: filename,
            mimeType: blob.type || 'image/jpeg'
          })
        });
        const json = await res.json();
        resolve(json);
      } catch (err) {
        reject(err);
      }
    };
    reader.readAsDataURL(blob);
  });
}
```

Lalu panggil `uploadToDrive(blob, name)` setelah / bersamaan dengan `saveToGallery`.

---

## Catatan Teknis

- Kamera hanya bekerja di **HTTPS** atau `localhost`
- IndexedDB menyimpan foto di browser tamu (bukan server)
- Untuk melihat **semua** foto dari semua tamu → buka folder Google Drive
- Folder Drive sebaiknya diset **"Anyone with the link can view"** (atau edit jika ingin tamu upload manual)

## Struktur File

```
├── index.html
├── style.css
├── script.js
└── README.md
```

Selamat merayakan! 💍
