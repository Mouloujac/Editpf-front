import React, { useState, useRef, useEffect } from "react";
import ReactCrop, {
  makeAspectCrop,
  convertToPixelCrop,
} from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { canvasPreview } from "./canvasPreview";
import { useDebounceEffect } from "./useDebounceEffect";
import axios from "axios";

function centerCrop(mediaWidth, mediaHeight, aspect) {
  return makeAspectCrop(
    {
      unit: "%",
      width: 90,
    },
    aspect,
    mediaWidth,
    mediaHeight,
  );
}

function centerAspectCrop(mediaWidth, mediaHeight, aspect) {
  return centerCrop(mediaWidth, mediaHeight, aspect);
}

export default function Crop({onCropChange, imgSrc, fileName}) {
  
  const previewCanvasRef = useRef(null);
  const imgRef = useRef(null);
  const hiddenAnchorRef = useRef(null);
  const blobUrlRef = useRef("");
  const [crop, setCrop] = useState();
  const [completedCrop, setCompletedCrop] = useState();
  const [scale, setScale] = useState(1);
  const [rotate, setRotate] = useState(0);
  const [aspect, setAspect] = useState(undefined);
  const [isSepia, setIsSepia] = useState(false);
  const [isBlackAndWhite, setIsBlackAndWhite] = useState(false);
  const [newImage, setNewImage] = useState()
  

  const toggleSepia = () => {
    setIsSepia(!isSepia);
    setIsBlackAndWhite(false); // Ensure only one filter is applied at a time
  };

  const toggleBlackAndWhite = () => {
    setIsBlackAndWhite(!isBlackAndWhite);
    setIsSepia(false); // Ensure only one filter is applied at a time
  };

  const imageStyle = {
    maxWidth: "100%",
    filter: isSepia
      ? "sepia(1)"
      : isBlackAndWhite
      ? "grayscale(1)"
      : "none",
    transform: `scale(${scale}) rotate(${rotate}deg)`
  };

  const aspectOptions = [
    { label: "Libre", value: undefined },
    { label: "16:9", value: 16 / 9 },
    { label: "1:1", value: 1 },
    
    // Ajoutez d'autres options d'aspect au besoin
  ];

  function onImageLoad(e) {
      const { width, height } = e.currentTarget;
      setCrop(centerAspectCrop(width, height, aspect));
      
    
  }





  async function onDownloadCropClick() {
    
    const image = imgRef.current;
    const previewCanvas = previewCanvasRef.current;
    if (!image || !previewCanvas || !completedCrop) {
      throw new Error("Crop canvas does not exist");
    }

    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    const offscreen = new OffscreenCanvas(
      completedCrop.width * scaleX,
      completedCrop.height * scaleY
    );
    const ctx = offscreen.getContext("2d");
    if (!ctx) {
      throw new Error("No 2d context");
    }

    ctx.drawImage(
      previewCanvas,
      0,
      0,
      previewCanvas.width,
      previewCanvas.height,
      0,
      0,
      offscreen.width,
      offscreen.height
    );

    const blob = await offscreen.convertToBlob({
      type: "image/png",
    });
    
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
    }
    const dataURL = await blobToDataURL(blob);

    const filterRoute = isSepia ? "applySepia" : isBlackAndWhite ? "applyBlackAndWhite" : null;
    if (filterRoute === null){
      blobUrlRef.current = URL.createObjectURL(blob);
      hiddenAnchorRef.current.href = blobUrlRef.current;
      hiddenAnchorRef.current.download = fileName;
      hiddenAnchorRef.current.click();
    }else{
      colorChange(dataURL)
    }
  }





  function colorChange(dataURL){
    const filterRoute = isSepia ? "applySepia" : isBlackAndWhite ? "applyBlackAndWhite" : null;

    const base64Image = dataURL.split(",")[1];

    axios
        .post(`http://localhost:8000/${filterRoute}`, {
          imageData: base64Image,
        }, {
          responseType: 'blob', // Set the response type to blob
        })
        .then((response) => {
          // Create a blob from the response data
          const blob = new Blob([response.data], { type: response.headers['content-type'] });
          console.log(blob)
          // Create a link element
          const link = document.createElement('a');
          link.href = window.URL.createObjectURL(blob);
          // Set the download attribute with the desired file name
          link.download = fileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        })
        .catch((error) => {
          console.error("Error:", error);
        });
  }








  function blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  useDebounceEffect(
    () => {
      (async () => {
        if (
          completedCrop?.width &&
          completedCrop?.height &&
          imgRef.current &&
          previewCanvasRef.current
        ) {
          await canvasPreview(
            imgRef.current,
            previewCanvasRef.current,
            completedCrop,
            scale,
            rotate
          );
        }
      })();
    },
    100,
    [completedCrop, scale, rotate]
  );

  function handleAspectChange(selectedValue) {
    if (selectedValue === aspect) {
      setAspect(null);
      setCrop({});
      setCompletedCrop(null);
    } else {
      setAspect(selectedValue);

      if (imgRef.current) {
        const { width, height } = imgRef.current;

        let newCrop;
        if (completedCrop) {
          newCrop = centerAspectCrop(width, height, selectedValue);
        } else {
          newCrop = makeAspectCrop(
            {
              unit: "%",
              aspect: selectedValue,
              x: crop.x || 0,
              y: crop.y || 0,
              width: crop.width || 100,
              height: crop.height || 100,
            },
            width,
            height
          );
        }

        setCrop(newCrop);
        setCompletedCrop(convertToPixelCrop(newCrop, width, height));
      }
    }
  }

  return (
    <div className="Crop">
      <button onClick={onCropChange}>Crop</button>

      <div className="Crop-Controls">
        <div>
        <label htmlFor="rotate-input">Rotate: </label>
          <input
            id="rotate-input"
            type="number"
            value={rotate}
            disabled={!imgSrc}
            onChange={(e) =>
              setRotate(Math.min(180, Math.max(-180, Number(e.target.value))))
            }
          />
        </div>
        <div>
        <label htmlFor="scale-input">Scale: </label>
          <input
            id="scale-input"
            type="range"
            step="0.1"
            value={scale}
            disabled={!imgSrc}
            onChange={(e) => setScale(Number(e.target.value))}
            min='1.0'
          />
          <span>{scale.toFixed(1)}</span> 
          <div>
            <button onClick={toggleSepia}>Toggle Sepia</button>
          </div>
          <div>
            <button onClick={toggleBlackAndWhite}>Toggle B&W</button>
          </div>
        </div>
        <div>
          <label htmlFor="aspectSelect">Aspect Ratio:</label>
          <select
            id="aspectSelect"
            value={aspect || ""}
            onChange={(e) => handleAspectChange(parseFloat(e.target.value))}
          >
            
            {aspectOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          
        </div>
        
             
      </div>
      {!!imgSrc && (
        
        <ReactCrop
          crop={crop}
          onChange={(_, percentCrop) => setCrop(percentCrop)}
          onComplete={(c) => setCompletedCrop(c)}
          aspect={aspect}
        >
          <img
            ref={imgRef}
            alt="Crop me"
            src={imgSrc}
            style={imageStyle}
            onLoad={onImageLoad}
          />
        </ReactCrop>
      )}
      {!!completedCrop && (
        <>
          { <div>
            <canvas
              ref={previewCanvasRef}
              style={{
                border: "1px solid black",
                objectFit: "contain",
                width: completedCrop.width,
                height: completedCrop.height,
                display: "none",
              }}
            />
          </div> }
          
          <div>
            <button onClick={onDownloadCropClick}>Download Crop</button>
            {/* <div style={{ fontSize: 12, color: "#666" }}>
              You need to open the CodeSandbox preview in a new window (top
              right icon) as security restrictions prevent the download
            </div> */}
            <a
              href="#hidden"
              ref={hiddenAnchorRef}
              download
              style={{
                position: "absolute",
                top: "-200vh",
                visibility: "hidden",
              }}
            >
              Hidden download
            </a>
          </div>
        </>
      )}
    </div>
  );
}

