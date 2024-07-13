import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as faceapi from 'face-api.js';
import io from 'socket.io-client';

const FaceDetection = () => {
    const videoRef = useRef();
    const canvasRef = useRef();
    const [warning, setWarning] = useState('');
    const [capturedImages, setCapturedImages] = useState([]);
    const streamRef = useRef(null);
    const socketRef = useRef(null);
    const [completed, setCompleted] = useState(false);

    const setupCamera = useCallback(async () => {
        const video = videoRef.current;
        const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
        video.srcObject = stream;
        streamRef.current = stream;

        return new Promise((resolve) => {
            video.onloadedmetadata = () => {
                resolve(video);
            };
        });
    }, []);

    const loadModels = useCallback(async () => {
        await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
    }, []);

    const detectFace = useCallback(async (video) => {
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        const displaySize = { width: video.width, height: video.height };
        faceapi.matchDimensions(canvas, displaySize);

        const detectInterval = setInterval(async () => {
            if (capturedImages.length >= 25) {
                socketRef.current.emit('train', { name: localStorage.getItem('name') });
                clearInterval(detectInterval);
                releaseResources();
                setCompleted(true);
                return;
            }


            const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions());
            const resizedDetections = faceapi.resizeResults(detections, displaySize);

            if (resizedDetections.length > 0) {
                context.drawImage(video, 0, 0, video.width, video.height);
                const base64Image = canvas.toDataURL('image/png');
                socketRef.current.emit('registered', { image: base64Image, name: localStorage.getItem('name') });
                setCapturedImages(prev => [...prev, base64Image]);
                setWarning('');
            } else {
                setWarning('Face not detected!');
            }
        }, 100); // Changed to 250 milliseconds

        return () => clearInterval(detectInterval);
    }, [capturedImages]);

    const releaseResources = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
        }
        if (socketRef.current) {
            socketRef.current.disconnect();
        }
    }, []);

    useEffect(() => {
        socketRef.current = io('https://ebitsvisionai.in',{
          transports: ['websocket'],
        });

        (async () => {
            await loadModels();
            const video = await setupCamera();
            detectFace(video);
        })();

        return () => {
            releaseResources();
        };
    }, []);

    useEffect(() => {
        if (capturedImages.length >= 25) {
            socketRef.current.emit('train', { name: localStorage.getItem('name') });
            releaseResources();
            setCompleted(true);
        }
    }, [capturedImages, releaseResources]);

    if (completed) {
        return (
            <div>
                <h2>Thank you for face recognition!</h2>
                <p>25 images have been captured and sent to the server.</p>
            </div>
        );
    }

    return (
        <div>
            <video ref={videoRef} width="640" height="480" autoPlay muted></video>
            <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
            <div style={{ color: 'red' }}>{warning}</div>
            <div>Captured Images: {capturedImages.length}/25</div>
        </div>
    );
};

export default FaceDetection;

// import React, { useEffect, useRef, useState, useCallback } from 'react';
// import * as faceapi from 'face-api.js';
// import io from 'socket.io-client';

// const FaceDetection = () => {
//   const videoRef = useRef();
//   const canvasRef = useRef();
//   const [warning, setWarning] = useState('');
//   const [capturedImages, setCapturedImages] = useState([]);
//   const streamRef = useRef(null);
//   const socketRef = useRef(null);
//   const [completed, setCompleted] = useState(false);
//   const [mode, setMode] = useState('select'); // 'select', 'register', or 'recognize'
//   const [name, setName] = useState('');
//   const [recognizedName, setRecognizedName] = useState('');

//   const setupCamera = useCallback(async () => {
//     const video = videoRef.current;
//     const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
//     video.srcObject = stream;
//     streamRef.current = stream;

//     return new Promise((resolve) => {
//       video.onloadedmetadata = () => {
//         resolve(video);
//       };
//     });
//   }, []);

//   const loadModels = useCallback(async () => {
//     await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
//   }, []);

//   const detectFace = useCallback(async (video) => {
//     const canvas = canvasRef.current;
//     const context = canvas.getContext('2d');
//     const displaySize = { width: video.width, height: video.height };
//     faceapi.matchDimensions(canvas, displaySize);

//     const detectInterval = setInterval(async () => {
//       if (capturedImages.length >= 25) {
//         clearInterval(detectInterval);
//         releaseResources();
//         if (mode === 'register') {
//           socketRef.current.emit('register-face', { name, images: capturedImages });
//         } else if (mode === 'recognize') {
//           socketRef.current.emit('recognize-face', capturedImages[0]);
//         }
//         return;
//       }

//       const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions());
//       const resizedDetections = faceapi.resizeResults(detections, displaySize);

//       if (resizedDetections.length > 0) {
//         context.drawImage(video, 0, 0, video.width, video.height);
//         const base64Image = canvas.toDataURL('image/png');
//         setCapturedImages(prev => [...prev, base64Image]);
//         setWarning('');
//       } else {
//         setWarning('Face not detected!');
//       }
//     }, 100);

//     return () => clearInterval(detectInterval);
//   }, [capturedImages, mode, name]);

//   const releaseResources = useCallback(() => {
//     if (streamRef.current) {
//       streamRef.current.getTracks().forEach(track => track.stop());
//     }
//   }, []);

//   useEffect(() => {
//     socketRef.current = io('http://localhost:8000');

//     socketRef.current.on('registration-complete', (result) => {
//       if (result.success) {
//         setCompleted(true);
//       } else {
//         setWarning('Registration failed: ' + result.message);
//       }
//     });

//     socketRef.current.on('recognition-result', (result) => {
//       setRecognizedName(result.name);
//       setCompleted(true);
//     });

//     return () => {
//       if (socketRef.current) {
//         socketRef.current.disconnect();
//       }
//     };
//   }, []);

//   useEffect(() => {
//     if (mode === 'register' || mode === 'recognize') {
//       (async () => {
//         await loadModels();
//         const video = await setupCamera();
//         detectFace(video);
//       })();
//     }
//   }, [mode]);

//   const handleModeSelect = (selectedMode) => {
//     setMode(selectedMode);
//     setCapturedImages([]);
//     setCompleted(false);
//     setRecognizedName('');
//   };

//   const handleBack = () => {
//     setMode('select');
//     releaseResources();
//     setCapturedImages([]);
//     setCompleted(false);
//     setRecognizedName('');
//   };

//   if (mode === 'select') {
//     return (
//       <div>
//         <h2>Choose an option:</h2>
//         <button onClick={() => handleModeSelect('register')}>Register Face</button>
//         <button onClick={() => handleModeSelect('recognize')}>Recognize Face</button>
//       </div>
//     );
//   }

//   if (completed) {
//     return (
//       <div>
//         <h2>{mode === 'register' ? 'Registration Complete!' : `Recognized Person: ${recognizedName}`}</h2>
//         <button onClick={handleBack}>Back</button>
//       </div>
//     );
//   }

//   return (
//     <div>
//       {mode === 'register' && (
//         <div>
//           <input
//             type="text"
//             placeholder="Enter your name"
//             value={name}
//             onChange={(e) => setName(e.target.value)}
//           />
//         </div>
//       )}
//       <video ref={videoRef} width="640" height="480" autoPlay muted></video>
//       <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
//       <div style={{ color: 'red' }}>{warning}</div>
//       <div>Captured Images: {capturedImages.length}/25</div> 
//     </div>
//   );
// };

// export default FaceDetection;