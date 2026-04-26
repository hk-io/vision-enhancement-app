# Vision Enhancement Application - Setup Guide

## For Beginners: Complete Setup Instructions

This guide will walk you through setting up and running the Vision Enhancement Application on your Windows laptop. No prior experience with web development is required.

---

## Prerequisites

Before you begin, you need to install several software tools. These are all free and widely used in web development.

### 1. Install Node.js

**Node.js** is a JavaScript runtime that allows you to run JavaScript code outside of a web browser. It includes **npm** (Node Package Manager), which is used to install the libraries and tools that the application depends on.

**Installation Steps:**

1. Visit the official Node.js website at [https://nodejs.org](https://nodejs.org)
2. Download the **LTS (Long Term Support)** version for Windows
3. Run the installer and follow the installation wizard
4. Accept all default settings
5. When installation is complete, verify it worked by opening Command Prompt and typing:
   ```
   node --version
   ```
   You should see a version number like `v20.x.x`

### 2. Install Visual Studio Code (VS Code)

**VS Code** is a free, lightweight code editor that is perfect for web development. It has excellent support for TypeScript, React, and all the technologies used in this project.

**Installation Steps:**

1. Visit [https://code.visualstudio.com](https://code.visualstudio.com)
2. Click "Download for Windows"
3. Run the installer
4. During installation, check the following options:
   - "Add to PATH"
   - "Register Code as an editor for supported file types"
   - "Add 'Open with Code' action to Windows Explorer context menu"
5. Complete the installation

### 3. Install Git (Optional but Recommended)

**Git** is a version control system that helps you track changes to your code. While not strictly required to run the application, it is useful for managing your project.

**Installation Steps:**

1. Visit [https://git-scm.com](https://git-scm.com)
2. Download Git for Windows
3. Run the installer
4. Accept all default settings

---

## Getting the Project Files

You have two options for getting the project files onto your computer.

### Option 1: Download from Manus (Recommended)

If the project was built using Manus, you can download all the files as a ZIP archive.

1. Click the download button in the Manus interface
2. Save the ZIP file to your desired location (e.g., `C:\Users\YourName\Documents\`)
3. Right-click the ZIP file and select "Extract All"
4. Choose a destination folder and click "Extract"

### Option 2: Download from GitHub

If the project is hosted on GitHub, you can clone or download it.

1. Navigate to the project's GitHub page
2. Click the green "Code" button
3. Select "Download ZIP"
4. Extract the ZIP file to your desired location

---

## Opening the Project in VS Code

Once you have the project files, you need to open them in VS Code.

1. Launch Visual Studio Code
2. Click "File" → "Open Folder"
3. Navigate to the project folder (the one containing `package.json`)
4. Click "Select Folder"

VS Code will open the project and display the file tree in the left sidebar.

---

## Installing Dependencies

The project depends on many external libraries (React, TypeScript, Tailwind CSS, etc.). These dependencies are listed in the `package.json` file but are not included in the download. You need to install them using npm.

### Steps:

1. In VS Code, open the **integrated terminal** by clicking "Terminal" → "New Terminal" (or press `` Ctrl+` ``)
2. The terminal will open at the bottom of the window
3. Make sure you are in the project directory (you should see the path in the terminal)
4. Type the following command and press Enter:
   ```
   npm install
   ```
5. npm will download and install all dependencies. This may take several minutes
6. When complete, you will see a message like "added XXX packages"

**Note:** If you see any warnings about vulnerabilities, you can ignore them for development purposes.

---

## Running the Application

Now that all dependencies are installed, you can start the development server and run the application.

### Steps:

1. In the VS Code terminal, type:
   ```
   npm run dev
   ```
2. The development server will start. You will see output like:
   ```
   VITE v5.x.x  ready in XXX ms
   
   ➜  Local:   http://localhost:5173/
   ➜  Network: use --host to expose
   ```
3. The application is now running!
4. Open your web browser (Chrome, Firefox, or Edge)
5. Navigate to `http://localhost:5173`
6. You should see the Vision Enhancement Application

### Using the Application:

1. Click the "Start Camera" button
2. Your browser will ask for camera permission - click "Allow"
3. Your camera feed will appear on the screen
4. Use the sliders on the right to adjust the enhancement settings:
   - **Contrast**: Makes the difference between light and dark areas stronger
   - **Brightness**: Makes the overall image lighter or darker
   - **Edge Sharpening**: Makes edges and details more visible
   - **Glare Suppression**: Reduces bright spots that cause discomfort
5. The changes are applied in real-time as you move the sliders
6. Click "Reset to Default" to return to the original settings
7. Click "Stop Camera" when you are done

---

## Understanding the Project Structure

When you open the project in VS Code, you will see many files and folders. Here is what the important ones do:

### Root Directory Files

| File | Purpose |
|------|---------|
| `package.json` | Lists all dependencies and scripts for the project |
| `tsconfig.json` | Configuration for TypeScript compiler |
| `vite.config.ts` | Configuration for Vite (the build tool) |
| `tailwind.config.ts` | Configuration for Tailwind CSS styling |

### Important Folders

| Folder | Contents |
|--------|----------|
| `client/src/` | All the source code for the application |
| `client/src/components/` | React components (UI building blocks) |
| `client/src/hooks/` | Custom React hooks (reusable logic) |
| `client/src/lib/` | Utility libraries (WebGL shaders) |
| `client/src/pages/` | Page components |
| `node_modules/` | Installed dependencies (don't modify this) |

### Key Files to Examine

If you want to understand or modify the code, start with these files:

1. **`client/src/pages/Home.tsx`** - The main page (very simple, just renders VisionEnhancer)
2. **`client/src/components/VisionEnhancer.tsx`** - The main application component with UI and logic
3. **`client/src/hooks/useCamera.ts`** - Camera access management
4. **`client/src/lib/webgl-shaders.ts`** - WebGL shaders for image processing (the "brain" of the app)

---

## Making Changes to the Code

One of the benefits of the development server is **hot reload** - when you save a file, the application automatically updates in the browser without needing to refresh.

### Example: Changing the Application Title

1. Open `client/src/components/VisionEnhancer.tsx` in VS Code
2. Find the line that says:
   ```tsx
   <h1 className="text-4xl font-bold text-gray-900 mb-2">
     Vision Enhancement System
   </h1>
   ```
3. Change "Vision Enhancement System" to your desired title
4. Press `Ctrl+S` to save the file
5. Look at your browser - the title has automatically updated!

### Example: Changing Default Settings

1. Open `client/src/components/VisionEnhancer.tsx`
2. Find the `DEFAULT_SETTINGS` constant:
   ```typescript
   const DEFAULT_SETTINGS: EnhancementSettings = {
     contrast: 1.2,
     brightness: 0.0,
     edgeStrength: 0.3,
     glareSuppression: 0.5,
   };
   ```
3. Change the values to your preferred defaults
4. Save the file
5. The application will restart with your new default values

---

## Testing on Your iOS Device

Since the application is a web app, you can test it on your iOS device without installing anything.

### Steps:

1. Make sure your Windows laptop and iOS device are on the same Wi-Fi network
2. In the VS Code terminal, stop the server (press `Ctrl+C`)
3. Restart the server with network access:
   ```
   npm run dev -- --host
   ```
4. You will see output like:
   ```
   ➜  Local:   http://localhost:5173/
   ➜  Network: http://192.168.1.XXX:5173/
   ```
5. On your iOS device, open Safari
6. Type the Network URL (the one starting with `192.168.1.XXX`) into the address bar
7. The application will load on your iOS device
8. You can now test the camera and enhancements on your phone

**Note:** Some features may work differently on mobile browsers. For best results, use Safari on iOS.

---

## Troubleshooting Common Issues

### Issue: "npm is not recognized"

**Cause:** Node.js was not installed correctly or is not in your PATH.

**Solution:**
1. Reinstall Node.js from [nodejs.org](https://nodejs.org)
2. Make sure to check "Add to PATH" during installation
3. Restart your computer
4. Try again

### Issue: "Camera permission denied"

**Cause:** You clicked "Block" when the browser asked for camera permission.

**Solution:**
1. In your browser, click the lock icon in the address bar
2. Find "Camera" in the permissions list
3. Change it to "Allow"
4. Refresh the page

### Issue: "WebGL not supported"

**Cause:** Your browser or graphics card does not support WebGL.

**Solution:**
1. Update your browser to the latest version
2. Update your graphics drivers
3. Try a different browser (Chrome usually has the best WebGL support)

### Issue: Application is slow or laggy

**Cause:** Your computer's GPU may not be powerful enough, or other applications are using resources.

**Solution:**
1. Close other applications, especially those using the camera
2. Try reducing the video resolution by modifying the camera constraints in `useCamera.ts`
3. Reduce the enhancement settings (lower edge strength and glare suppression)

### Issue: Changes to code are not appearing

**Cause:** The development server may not have detected the file change.

**Solution:**
1. Make sure you saved the file (`Ctrl+S`)
2. Check the terminal for any error messages
3. If still not working, stop the server (`Ctrl+C`) and restart it (`npm run dev`)

---

## Building for Production

When you are ready to deploy the application for others to use, you need to create a production build.

### Steps:

1. In the VS Code terminal, type:
   ```
   npm run build
   ```
2. The build process will create optimized files in the `dist` folder
3. These files can be uploaded to any web hosting service

### Hosting Options:

- **Netlify** - Free hosting with automatic deployments from GitHub
- **Vercel** - Similar to Netlify, optimized for React applications
- **GitHub Pages** - Free hosting for static websites
- **Your university server** - Many universities provide web hosting for students

---

## Recommended VS Code Extensions

These extensions will make your development experience better:

1. **ESLint** - Helps find and fix problems in your code
2. **Prettier** - Automatically formats your code to look consistent
3. **Tailwind CSS IntelliSense** - Autocomplete for Tailwind CSS classes
4. **GitLens** - Enhanced Git integration (if you are using Git)

To install extensions:
1. Click the Extensions icon in the left sidebar (or press `Ctrl+Shift+X`)
2. Search for the extension name
3. Click "Install"

---

## Next Steps

Now that you have the application running, here are some suggestions for what to do next:

1. **Read the Code Explanation** - Open `CODE_EXPLANATION.md` to understand how the code works
2. **Experiment with Settings** - Try different enhancement values to see their effects
3. **Modify the Algorithms** - Try changing the shader code in `webgl-shaders.ts` to implement new enhancements
4. **Conduct User Testing** - Test the application with people who have visual impairments and gather feedback
5. **Document Your Findings** - Use your observations for your thesis research

---

## Getting Help

If you encounter problems that are not covered in this guide:

1. **Check the browser console** - Press `F12` in your browser to open developer tools and look for error messages
2. **Check the terminal** - Look for error messages in the VS Code terminal
3. **Search online** - Copy error messages and search on Google or Stack Overflow
4. **Ask for help** - Reach out to your thesis supervisor or classmates

---

## Summary

You have successfully set up the Vision Enhancement Application on your Windows laptop. You can now run the application, make changes to the code, and test it on multiple devices. This foundation will support your Master's thesis research into AR-based visual assistance systems.

**Key Commands to Remember:**

- `npm install` - Install dependencies (run once after downloading the project)
- `npm run dev` - Start the development server
- `npm run build` - Create a production build
- `Ctrl+C` - Stop the development server

Good luck with your thesis research!
