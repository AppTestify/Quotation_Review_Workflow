import React, { useState, useRef, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { FaExpand, FaCompress } from 'react-icons/fa';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

const PDFViewer = ({ pdfUrl, annotations = [], onAnnotationAdd, onUndo, readOnly = false }) => {
  const [numPages, setNumPages] = useState(null);
  const [scale, setScale] = useState(1.0);
  const [pageWidth, setPageWidth] = useState(null);
  const [pageRefs, setPageRefs] = useState([]);
  const [canvasRefs, setCanvasRefs] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentAnnotation, setCurrentAnnotation] = useState(null);
  const [drawingType, setDrawingType] = useState('highlight');
  const containerRef = useRef(null);
  const [startPos, setStartPos] = useState(null);
  const [drawingPath, setDrawingPath] = useState([]);
  const [pagesRendered, setPagesRendered] = useState(0);
  
  // Font and styling options
  const [fontFamily, setFontFamily] = useState('Arial');
  const [fontSize, setFontSize] = useState(14);
  const [strokeColor, setStrokeColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [textInput, setTextInput] = useState('');
  const [showTextInput, setShowTextInput] = useState(false);
  const [textPosition, setTextPosition] = useState(null);
  const [rectangleTextInput, setRectangleTextInput] = useState('');
  const [showRectangleTextInput, setShowRectangleTextInput] = useState(false);
  const [pendingRectangle, setPendingRectangle] = useState(null);
  const [rectangleFillColor, setRectangleFillColor] = useState('#ffffff');
  const [rectangleTextColor, setRectangleTextColor] = useState('#000000');
  const [stampImage, setStampImage] = useState(null);
  const [stampSize, setStampSize] = useState(100);
  const fileInputRef = useRef(null);
  const [loadedImages, setLoadedImages] = useState(new Map());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const viewerRef = useRef(null);

  const fontFamilies = ['Arial', 'Times New Roman', 'Courier New', 'Georgia', 'Verdana', 'Helvetica', 'Comic Sans MS', 'Trebuchet MS'];

  const toggleFullscreen = async () => {
    if (!viewerRef.current) return;

    try {
      if (!document.fullscreenElement) {
        await viewerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (error) {
      console.error('Error toggling fullscreen:', error);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    const handleKeyDown = (e) => {
      // ESC key to exit fullscreen
      if (e.key === 'Escape' && document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
    // Initialize refs for each page
    setPageRefs(Array(numPages).fill(null).map(() => React.createRef()));
    setCanvasRefs(Array(numPages).fill(null).map(() => React.createRef()));
  };

  // Calculate page width based on container
  useEffect(() => {
    const updatePageWidth = () => {
      const container = containerRef.current;
      if (!container) {
        // If container not ready, try again after a short delay
        setTimeout(updatePageWidth, 100);
        return;
      }
      
      // Calculate available width (container width minus padding)
      const padding = isFullscreen ? 16 : 32; // p-2 = 8px each side, p-4 = 16px each side
      const availableWidth = container.offsetWidth - padding;
      
      // Set page width to fit container, with a max width constraint
      // Minimum width of 400px to ensure readability
      const maxWidth = Math.max(400, Math.min(availableWidth, 1200)); // Max 1200px wide, min 400px
      setPageWidth(maxWidth);
    };
    
    // Initial calculation
    updatePageWidth();
    
    // Set up resize observer
    let resizeObserver;
    if (containerRef.current && window.ResizeObserver) {
      resizeObserver = new ResizeObserver(updatePageWidth);
      resizeObserver.observe(containerRef.current);
    }
    
    window.addEventListener('resize', updatePageWidth);
    
    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      window.removeEventListener('resize', updatePageWidth);
    };
  }, [isFullscreen]);

  // Update canvas sizes when pages are rendered
  // Note: Canvas sizing is now handled in the annotation drawing useEffect to ensure synchronization
  useEffect(() => {
    if (!numPages || pageRefs.length === 0) return;
    
    const updateCanvasSizes = () => {
      canvasRefs.forEach((canvasRef, pageIndex) => {
        const canvas = canvasRef?.current;
        const pageElement = pageRefs[pageIndex]?.current;
        if (!canvas || !pageElement) return;
        
        const rect = pageElement.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          canvas.width = rect.width;
          canvas.height = rect.height;
          canvas.style.width = `${rect.width}px`;
          canvas.style.height = `${rect.height}px`;
        }
      });
    };
    
    // Update immediately
    updateCanvasSizes();
    
    // Update after a short delay to ensure pages are rendered
    const timeout = setTimeout(updateCanvasSizes, 100);
    
    return () => clearTimeout(timeout);
  }, [numPages, pageRefs, canvasRefs, scale, pageWidth]);

  const getCoordinates = (e, pageIndex) => {
    const pageElement = pageRefs[pageIndex]?.current;
    if (!pageElement) {
      const rect = e.currentTarget.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top, page: pageIndex + 1 };
    }
    const rect = pageElement.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      page: pageIndex + 1
    };
  };

  const handleMouseDown = async (e, pageIndex) => {
    if (readOnly) return;
    
    const { x, y, page } = getCoordinates(e, pageIndex);
    
    if (drawingType === 'stamp') {
      if (stampImage) {
        handleAddAnnotation({
          type: 'stamp',
          x: x - stampSize / 2,
          y: y - stampSize / 2,
          imageData: stampImage,
          width: stampSize,
          height: stampSize,
          page: page
        });
      } else {
        alert('Please upload a stamp image first');
        fileInputRef.current?.click();
      }
      return;
    }
    
    if (drawingType === 'text') {
      setTextPosition({ x, y, page });
      setShowTextInput(true);
      return;
    }
    
    if (drawingType === 'comment') {
      const comment = prompt('Enter comment:');
      if (comment) {
        handleAddAnnotation({
          type: 'comment',
          x,
          y,
          text: comment,
          page: page
        });
      }
      return;
    }
    
    if (drawingType === 'freedraw') {
      setDrawingPath([{ x, y, page }]);
      setIsDrawing(true);
      return;
    }
    
    setStartPos({ x, y, page });
    setIsDrawing(true);
  };

  const handleMouseMove = (e, pageIndex) => {
    if (!isDrawing || readOnly) return;
    
    const { x, y, page } = getCoordinates(e, pageIndex);
    
    if (drawingType === 'freedraw') {
      if (startPos && startPos.page === page) {
        setDrawingPath(prev => [...prev, { x, y }]);
      }
      return;
    }
    
    if (!startPos || startPos.page !== page) return;
    
    setCurrentAnnotation({
      type: drawingType,
      startX: startPos.x,
      startY: startPos.y,
      endX: x,
      endY: y,
      page: page
    });
  };

  const handleMouseUp = (e, pageIndex) => {
    if (!isDrawing || readOnly) return;
    
    const { x, y, page } = getCoordinates(e, pageIndex);
    
    if (!startPos || startPos.page !== page) {
      setIsDrawing(false);
      setStartPos(null);
      setCurrentAnnotation(null);
      return;
    }
    
    if (drawingType === 'freedraw') {
      if (drawingPath.length > 0) {
        handleAddAnnotation({
          type: 'freedraw',
          path: [...drawingPath, { x, y }],
          color: strokeColor,
          strokeWidth: strokeWidth,
          page: page
        });
      }
      setDrawingPath([]);
    } else if (drawingType === 'rectangle' && startPos) {
      // Store rectangle coordinates and prompt for text
      const rect = {
        startX: startPos.x,
        startY: startPos.y,
        endX: x,
        endY: y,
        color: strokeColor,
        fillColor: rectangleFillColor,
        strokeWidth: strokeWidth,
        page: page
      };
      setPendingRectangle(rect);
      setShowRectangleTextInput(true);
    } else if (drawingType !== 'comment' && drawingType !== 'text' && drawingType !== 'rectangle' && startPos) {
      handleAddAnnotation({
        type: drawingType,
        startX: startPos.x,
        startY: startPos.y,
        endX: x,
        endY: y,
        color: strokeColor,
        strokeWidth: strokeWidth,
        page: page
      });
    }
    
    setIsDrawing(false);
    setStartPos(null);
    setCurrentAnnotation(null);
  };

  const handleTextSubmit = () => {
    if (textInput.trim() && textPosition) {
      handleAddAnnotation({
        type: 'text',
        x: textPosition.x,
        y: textPosition.y,
        text: textInput,
        fontFamily: fontFamily,
        fontSize: fontSize,
        color: strokeColor,
        page: textPosition.page
      });
      setTextInput('');
      setShowTextInput(false);
      setTextPosition(null);
    }
  };

  const handleRectangleTextSubmit = () => {
    if (pendingRectangle) {
      const annotation = {
        type: 'rectangle',
        startX: pendingRectangle.startX,
        startY: pendingRectangle.startY,
        endX: pendingRectangle.endX,
        endY: pendingRectangle.endY,
        color: pendingRectangle.color,
        fillColor: pendingRectangle.fillColor,
        strokeWidth: pendingRectangle.strokeWidth,
        page: pendingRectangle.page
      };
      
      // Only add text properties if text is provided
      const trimmedText = rectangleTextInput.trim();
      if (trimmedText) {
        annotation.text = trimmedText;
        annotation.textFontFamily = fontFamily;
        annotation.textFontSize = fontSize;
        annotation.textColor = rectangleTextColor;
      }
      
      handleAddAnnotation(annotation);
      setRectangleTextInput('');
      setShowRectangleTextInput(false);
      setPendingRectangle(null);
    }
  };

  const handleRectangleTextCancel = () => {
    setRectangleTextInput('');
    setShowRectangleTextInput(false);
    setPendingRectangle(null);
  };

  const handleStampImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Check if it's an image
      if (!file.type.startsWith('image/')) {
        alert('Please upload an image file');
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (event) => {
        setStampImage(event.target.result);
      };
      reader.onerror = () => {
        alert('Error reading image file');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddAnnotation = (annotation) => {
    if (onAnnotationAdd) {
      onAnnotationAdd(annotation);
    }
  };

  const drawArrow = (ctx, startX, startY, endX, endY, color, lineWidth) => {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = lineWidth;
    
    // Draw line
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    
    // Calculate arrowhead
    const angle = Math.atan2(endY - startY, endX - startX);
    const arrowLength = 15;
    const arrowAngle = Math.PI / 6;
    
    // Draw arrowhead
    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(
      endX - arrowLength * Math.cos(angle - arrowAngle),
      endY - arrowLength * Math.sin(angle - arrowAngle)
    );
    ctx.lineTo(
      endX - arrowLength * Math.cos(angle + arrowAngle),
      endY - arrowLength * Math.sin(angle + arrowAngle)
    );
    ctx.closePath();
    ctx.fill();
    
    ctx.restore();
  };

  const drawAnnotations = (ctx, pageAnnotations) => {
    if (!pageAnnotations || pageAnnotations.length === 0) return;
    
    pageAnnotations.forEach((ann) => {
      if (!ann || !ann.type) return;
      
      ctx.save();
      
      if (ann.type === 'highlight') {
        if (ann.startX === undefined || ann.startY === undefined || ann.endX === undefined || ann.endY === undefined) {
          ctx.restore();
          return;
        }
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = ann.color || 'yellow';
        ctx.fillRect(ann.startX, ann.startY, ann.endX - ann.startX, ann.endY - ann.startY);
      } else if (ann.type === 'stamp' && ann.imageData) {
        // Draw stamp image if it's already loaded
        const imageKey = ann.imageData.substring(0, 50);
        if (loadedImages.has(imageKey)) {
          const img = loadedImages.get(imageKey);
          if (img.complete) {
            ctx.drawImage(img, ann.x, ann.y, ann.width || 100, ann.height || 100);
          }
        }
      } else if (ann.type === 'rectangle') {
        if (ann.startX === undefined || ann.startY === undefined || ann.endX === undefined || ann.endY === undefined) {
          ctx.restore();
          return;
        }
        const width = ann.endX - ann.startX;
        const height = ann.endY - ann.startY;
        
        // Draw fill
        if (ann.fillColor) {
          ctx.fillStyle = ann.fillColor;
          ctx.fillRect(ann.startX, ann.startY, width, height);
        }
        
        // Draw border
        ctx.strokeStyle = ann.color || 'red';
        ctx.lineWidth = ann.strokeWidth || 2;
        ctx.strokeRect(ann.startX, ann.startY, width, height);
        
        // Draw text inside rectangle
        if (ann.text && ann.text.trim()) {
          ctx.fillStyle = ann.textColor || '#000000';
          ctx.font = `${ann.textFontSize || 14}px ${ann.textFontFamily || 'Arial'}`;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          
          // Calculate text position (with padding)
          const textX = ann.startX + 5;
          const textY = ann.startY + 5;
          
          // Word wrap if text is too long
          const maxWidth = Math.abs(width) - 10;
          if (maxWidth > 0) {
            const words = ann.text.split(' ');
            let line = '';
            let y = textY;
            const lineHeight = ann.textFontSize || 14;
            
            for (let i = 0; i < words.length; i++) {
              const testLine = line + words[i] + ' ';
              const metrics = ctx.measureText(testLine);
              if (metrics.width > maxWidth && i > 0) {
                ctx.fillText(line.trim(), textX, y);
                line = words[i] + ' ';
                y += lineHeight;
              } else {
                line = testLine;
              }
            }
            if (line.trim()) {
              ctx.fillText(line.trim(), textX, y);
            }
          }
        }
      } else if (ann.type === 'arrow') {
        if (ann.startX === undefined || ann.startY === undefined || ann.endX === undefined || ann.endY === undefined) {
          ctx.restore();
          return;
        }
        drawArrow(ctx, ann.startX, ann.startY, ann.endX, ann.endY, ann.color || '#000000', ann.strokeWidth || 2);
      } else if (ann.type === 'freedraw' && ann.path && ann.path.length > 0) {
        ctx.strokeStyle = ann.color || '#000000';
        ctx.lineWidth = ann.strokeWidth || 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(ann.path[0].x, ann.path[0].y);
        for (let i = 1; i < ann.path.length; i++) {
          ctx.lineTo(ann.path[i].x, ann.path[i].y);
        }
        ctx.stroke();
      } else if (ann.type === 'text') {
        if (ann.x === undefined || ann.y === undefined || !ann.text) {
          ctx.restore();
          return;
        }
        ctx.fillStyle = ann.color || '#000000';
        ctx.font = `${ann.fontSize || 14}px ${ann.fontFamily || 'Arial'}`;
        ctx.fillText(ann.text, ann.x, ann.y);
      } else if (ann.type === 'comment') {
        if (ann.x === undefined || ann.y === undefined) {
          ctx.restore();
          return;
        }
        ctx.fillStyle = 'blue';
        ctx.beginPath();
        ctx.arc(ann.x, ann.y, 5, 0, 2 * Math.PI);
        ctx.fill();
        if (ann.text) {
          ctx.fillStyle = 'black';
          ctx.font = '12px Arial';
          ctx.fillText(ann.text, ann.x + 10, ann.y);
        }
      }
      
      ctx.restore();
    });
  };

  useEffect(() => {
    // Draw annotations on each page's canvas
    if (!numPages || canvasRefs.length === 0 || pageRefs.length === 0) return;
    
    const drawAllAnnotations = () => {
      canvasRefs.forEach((canvasRef, pageIndex) => {
        const canvas = canvasRef?.current;
        if (!canvas) return;
        
        const pageElement = pageRefs[pageIndex]?.current;
        if (!pageElement) return;
        
        // Ensure canvas is properly sized
        const rect = pageElement.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          // Only update if size changed to avoid unnecessary redraws
          if (canvas.width !== rect.width || canvas.height !== rect.height) {
            canvas.width = rect.width;
            canvas.height = rect.height;
            canvas.style.width = `${rect.width}px`;
            canvas.style.height = `${rect.height}px`;
          }
        }
        
        const ctx = canvas.getContext('2d');
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const pageNum = pageIndex + 1;
        // Handle both string and number page values
        const pageAnnotations = annotations.filter(ann => {
          if (!ann || !ann.page) return false;
          const annPage = typeof ann.page === 'string' ? parseInt(ann.page) : ann.page;
          return annPage === pageNum;
        });
        
        // Draw annotations for this page
        if (pageAnnotations.length > 0) {
          drawAnnotations(ctx, pageAnnotations);
        }
      
        // Load and draw stamp images
        pageAnnotations
          .filter(ann => ann.type === 'stamp' && ann.imageData)
          .forEach((ann) => {
            const imageKey = ann.imageData.substring(0, 50);
            if (loadedImages.has(imageKey)) {
              const img = loadedImages.get(imageKey);
              if (img.complete) {
                ctx.drawImage(img, ann.x, ann.y, ann.width || 100, ann.height || 100);
              }
            } else {
              const img = new Image();
              img.onload = () => {
                setLoadedImages(prev => {
                  const newMap = new Map(prev);
                  newMap.set(imageKey, img);
                  return newMap;
                });
                // Redraw annotations for this page
                setTimeout(() => {
                  const canvas = canvasRefs[pageIndex]?.current;
                  if (!canvas) return;
                  const ctx = canvas.getContext('2d');
                  ctx.clearRect(0, 0, canvas.width, canvas.height);
                  const annPage = typeof ann.page === 'string' ? parseInt(ann.page) : ann.page;
                  const currentPageAnnotations = annotations.filter(a => {
                    const aPage = typeof a.page === 'string' ? parseInt(a.page) : a.page;
                    return aPage === pageNum;
                  });
                  drawAnnotations(ctx, currentPageAnnotations);
                  ctx.drawImage(img, ann.x, ann.y, ann.width || 100, ann.height || 100);
                }, 0);
              };
              img.src = ann.imageData;
            }
          });
        
        // Draw current annotation being drawn on this page
        if (currentAnnotation) {
          const currentPage = typeof currentAnnotation.page === 'string' ? parseInt(currentAnnotation.page) : currentAnnotation.page;
          if (currentPage === pageNum) {
            drawAnnotations(ctx, [currentAnnotation]);
          }
        }
        
        if (drawingType === 'freedraw' && drawingPath.length > 0 && startPos) {
          const startPage = typeof startPos.page === 'string' ? parseInt(startPos.page) : startPos.page;
          if (startPage === pageNum) {
            ctx.save();
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = strokeWidth;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(drawingPath[0].x, drawingPath[0].y);
            for (let i = 1; i < drawingPath.length; i++) {
              ctx.lineTo(drawingPath[i].x, drawingPath[i].y);
            }
            ctx.stroke();
            ctx.restore();
          }
        }
        
        // Draw pending rectangle on this page
        if (pendingRectangle && !showRectangleTextInput) {
          const rectPage = typeof pendingRectangle.page === 'string' ? parseInt(pendingRectangle.page) : pendingRectangle.page;
          if (rectPage === pageNum) {
            const width = pendingRectangle.endX - pendingRectangle.startX;
            const height = pendingRectangle.endY - pendingRectangle.startY;
            ctx.save();
            if (pendingRectangle.fillColor) {
              ctx.fillStyle = pendingRectangle.fillColor;
              ctx.fillRect(pendingRectangle.startX, pendingRectangle.startY, width, height);
            }
            ctx.strokeStyle = pendingRectangle.color;
            ctx.lineWidth = pendingRectangle.strokeWidth;
            ctx.strokeRect(pendingRectangle.startX, pendingRectangle.startY, width, height);
            ctx.restore();
          }
        }
      });
    };
    
    // Draw immediately
    drawAllAnnotations();
    
    // Also draw after a short delay to ensure PDF pages are fully rendered
    const timeout = setTimeout(drawAllAnnotations, 200);
    
    return () => clearTimeout(timeout);
  }, [annotations, currentAnnotation, drawingPath, drawingType, strokeColor, strokeWidth, pendingRectangle, showRectangleTextInput, loadedImages, startPos, canvasRefs, pageRefs, numPages, scale, pageWidth, pagesRendered]);

  return (
    <div className={`flex flex-col h-full ${isFullscreen ? 'bg-gray-800' : ''}`} ref={viewerRef}>
      {!readOnly && (
        <div className={`${isFullscreen ? 'bg-gray-900 text-white border-gray-700' : 'bg-gray-100'} p-2 border-b`}>
          {/* Tool Selection */}
          <div className="flex items-center space-x-2 mb-2 flex-wrap">
            <button
              onClick={() => setDrawingType('highlight')}
              className={`px-3 py-1 rounded text-sm ${
                drawingType === 'highlight' 
                  ? 'bg-blue-600 text-white' 
                  : isFullscreen 
                    ? 'bg-gray-700 text-white hover:bg-gray-600' 
                    : 'bg-white text-gray-700'
              }`}
            >
              Highlight
            </button>
            <button
              onClick={() => setDrawingType('rectangle')}
              className={`px-3 py-1 rounded text-sm ${
                drawingType === 'rectangle' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'
              }`}
            >
              Rectangle
            </button>
            <button
              onClick={() => setDrawingType('arrow')}
              className={`px-3 py-1 rounded text-sm ${
                drawingType === 'arrow' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'
              }`}
            >
              Arrow
            </button>
            <button
              onClick={() => setDrawingType('freedraw')}
              className={`px-3 py-1 rounded text-sm ${
                drawingType === 'freedraw' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'
              }`}
            >
              Free Draw
            </button>
            <button
              onClick={() => setDrawingType('text')}
              className={`px-3 py-1 rounded text-sm ${
                drawingType === 'text' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'
              }`}
            >
              Text
            </button>
            <button
              onClick={() => setDrawingType('comment')}
              className={`px-3 py-1 rounded text-sm ${
                drawingType === 'comment' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'
              }`}
            >
              Comment
            </button>
            <button
              onClick={() => setDrawingType('stamp')}
              className={`px-3 py-1 rounded text-sm ${
                drawingType === 'stamp' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'
              }`}
            >
              Stamp
            </button>
          </div>
          
          {/* Hidden file input for stamp upload */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleStampImageUpload}
            className="hidden"
          />

          {/* Stamp Controls */}
          {drawingType === 'stamp' && (
            <div className="flex items-center space-x-4 flex-wrap gap-2 mb-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
              >
                {stampImage ? 'Change Stamp' : 'Upload Stamp'}
              </button>
              {stampImage && (
                <>
                  <div className="flex items-center space-x-2">
                    <img src={stampImage} alt="Stamp preview" className="h-8 w-8 object-contain border rounded" />
                    <span className="text-sm text-gray-600">Stamp loaded</span>
                  </div>
                  <label className="text-sm font-medium">Size:</label>
                  <input
                    type="number"
                    min="50"
                    max="300"
                    value={stampSize}
                    onChange={(e) => setStampSize(parseInt(e.target.value) || 100)}
                    className="w-20 px-2 py-1 border rounded text-sm"
                  />
                  <span className="text-sm text-gray-600">px</span>
                </>
              )}
            </div>
          )}

          {/* Font and Style Controls */}
          {(drawingType === 'text' || drawingType === 'freedraw' || drawingType === 'arrow' || drawingType === 'rectangle') && (
            <div className="flex items-center space-x-4 flex-wrap gap-2">
              {(drawingType === 'text' || drawingType === 'rectangle') && (
                <>
                  <label className="text-sm font-medium">Font:</label>
                  <select
                    value={fontFamily}
                    onChange={(e) => setFontFamily(e.target.value)}
                    className="px-2 py-1 border rounded text-sm"
                  >
                    {fontFamilies.map(font => (
                      <option key={font} value={font}>{font}</option>
                    ))}
                  </select>
                  <label className="text-sm font-medium">Size:</label>
                  <input
                    type="number"
                    min="8"
                    max="72"
                    value={fontSize}
                    onChange={(e) => setFontSize(parseInt(e.target.value) || 14)}
                    className="w-16 px-2 py-1 border rounded text-sm"
                  />
                </>
              )}
              {drawingType === 'rectangle' && (
                <>
                  <label className="text-sm font-medium">Border:</label>
                  <input
                    type="color"
                    value={strokeColor}
                    onChange={(e) => setStrokeColor(e.target.value)}
                    className="w-10 h-8 border rounded cursor-pointer"
                  />
                  <label className="text-sm font-medium">Fill:</label>
                  <input
                    type="color"
                    value={rectangleFillColor}
                    onChange={(e) => setRectangleFillColor(e.target.value)}
                    className="w-10 h-8 border rounded cursor-pointer"
                  />
                  <label className="text-sm font-medium">Text Color:</label>
                  <input
                    type="color"
                    value={rectangleTextColor}
                    onChange={(e) => setRectangleTextColor(e.target.value)}
                    className="w-10 h-8 border rounded cursor-pointer"
                  />
                </>
              )}
              {drawingType !== 'rectangle' && (
                <>
                  <label className="text-sm font-medium">Color:</label>
                  <input
                    type="color"
                    value={strokeColor}
                    onChange={(e) => setStrokeColor(e.target.value)}
                    className="w-10 h-8 border rounded cursor-pointer"
                  />
                </>
              )}
              {(drawingType === 'freedraw' || drawingType === 'arrow' || drawingType === 'rectangle') && (
                <>
                  <label className="text-sm font-medium">Width:</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={strokeWidth}
                    onChange={(e) => setStrokeWidth(parseInt(e.target.value) || 2)}
                    className="w-16 px-2 py-1 border rounded text-sm"
                  />
                </>
              )}
            </div>
          )}

          {/* Undo, Zoom, and Fullscreen Controls */}
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center space-x-2">
              {onUndo && annotations.length > 0 && (
                <button
                  onClick={onUndo}
                  className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                  title="Undo last annotation"
                >
                  Undo
                </button>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setScale(Math.max(0.5, scale - 0.1))}
                className={`px-2 py-1 rounded text-sm ${
                  isFullscreen 
                    ? 'bg-gray-700 text-white hover:bg-gray-600' 
                    : 'bg-white hover:bg-gray-100'
                }`}
                title="Zoom out"
              >
                -
              </button>
              <span className={`text-sm ${isFullscreen ? 'text-white' : ''}`}>{Math.round(scale * 100)}%</span>
              <button
                onClick={() => setScale(Math.min(2, scale + 0.1))}
                className={`px-2 py-1 rounded text-sm ${
                  isFullscreen 
                    ? 'bg-gray-700 text-white hover:bg-gray-600' 
                    : 'bg-white hover:bg-gray-100'
                }`}
                title="Zoom in"
              >
                +
              </button>
              <button
                onClick={toggleFullscreen}
                className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 flex items-center space-x-1"
                title={isFullscreen ? "Exit fullscreen (Press ESC)" : "Enter fullscreen"}
              >
                {isFullscreen ? (
                  <>
                    <FaCompress className="w-4 h-4" />
                    <span>Exit Fullscreen</span>
                  </>
                ) : (
                  <>
                    <FaExpand className="w-4 h-4" />
                    <span>Fullscreen</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div className={`flex-1 overflow-y-auto overflow-x-hidden bg-gray-200 ${isFullscreen ? 'p-2' : 'p-4'}`} ref={containerRef}>
        <div className="flex flex-col items-center space-y-4" style={{ width: '100%', minWidth: 0 }}>
          <Document
            file={pdfUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            loading={<div className="text-center p-8">Loading PDF...</div>}
            error={<div className="text-center p-8 text-red-600">Error loading PDF</div>}
          >
            {numPages && Array.from({ length: numPages }, (_, index) => {
              const pageNum = index + 1;
              return (
                <div 
                  key={pageNum} 
                  className="relative mb-4 shadow-lg bg-white inline-block" 
                  ref={pageRefs[index]}
                  onMouseDown={(e) => handleMouseDown(e, index)}
                  onMouseMove={(e) => handleMouseMove(e, index)}
                  onMouseUp={(e) => handleMouseUp(e, index)}
                  style={{ maxWidth: '100%', overflow: 'hidden' }}
                >
                  <Page
                    pageNumber={pageNum}
                    width={pageWidth ? pageWidth * scale : undefined}
                    scale={pageWidth ? undefined : scale}
                    renderTextLayer={true}
                    renderAnnotationLayer={true}
                    onRenderSuccess={() => {
                      // Trigger annotation redraw when page is rendered
                      setPagesRendered(prev => prev + 1);
                    }}
                  />
                  <canvas
                    ref={canvasRefs[index]}
                    className="absolute top-0 left-0 pointer-events-none"
                    style={{ zIndex: 10, position: 'absolute' }}
                  />
                </div>
              );
            })}
          </Document>
          {showTextInput && textPosition && pageRefs[textPosition.page - 1]?.current && (() => {
            const pageRect = pageRefs[textPosition.page - 1].current.getBoundingClientRect();
            return (
              <div
                className="fixed bg-white border-2 border-blue-500 rounded p-2 shadow-lg"
                style={{
                  left: `${pageRect.left + textPosition.x}px`,
                  top: `${pageRect.top + textPosition.y}px`,
                  zIndex: 20
                }}
              >
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleTextSubmit();
                  } else if (e.key === 'Escape') {
                    setShowTextInput(false);
                    setTextInput('');
                    setTextPosition(null);
                  }
                }}
                onBlur={handleTextSubmit}
                autoFocus
                className="outline-none border-none text-sm"
                style={{ fontFamily: fontFamily, fontSize: `${fontSize}px`, color: strokeColor }}
                placeholder="Type text..."
              />
              </div>
            );
          })()}
          {showRectangleTextInput && pendingRectangle && (
            <div
              className="fixed bg-white border-2 border-blue-500 rounded p-3 shadow-lg"
              style={{
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 30,
                minWidth: '300px'
              }}
            >
              <label className="block text-sm font-medium mb-2">Enter text for rectangle:</label>
              <textarea
                value={rectangleTextInput}
                onChange={(e) => setRectangleTextInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.ctrlKey) {
                    e.preventDefault();
                    handleRectangleTextSubmit();
                  } else if (e.key === 'Escape') {
                    handleRectangleTextCancel();
                  }
                }}
                onBlur={(e) => {
                  // Small delay to allow button clicks to register
                  setTimeout(() => {
                    if (showRectangleTextInput && pendingRectangle) {
                      handleRectangleTextSubmit();
                    }
                  }, 200);
                }}
                autoFocus
                className="w-full px-2 py-1 border rounded text-sm mb-2 outline-none"
                style={{ fontFamily: fontFamily, fontSize: `${fontSize}px`, color: rectangleTextColor }}
                placeholder="Type text for rectangle (Ctrl+Enter to confirm, Esc to cancel)..."
                rows="3"
              />
              <div className="flex justify-end space-x-2">
                <button
                  onClick={handleRectangleTextCancel}
                  className="px-3 py-1 bg-gray-200 rounded text-sm hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRectangleTextSubmit}
                  className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                >
                  Add Text
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      
      <div className="bg-gray-100 p-2 flex items-center justify-center border-t">
        <span className="text-sm">
          {numPages ? `${numPages} page${numPages > 1 ? 's' : ''}` : 'Loading...'}
        </span>
      </div>
    </div>
  );
};

export default PDFViewer;
