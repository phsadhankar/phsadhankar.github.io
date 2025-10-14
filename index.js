const iframe = document.getElementById("content-iframe");
const menuItems = document.querySelectorAll(".menu-item");

function loadPage(pageName) {
    const loading = document.querySelector(".loading");
    loading.style.display = "block";

    // Remove active class from all items
    menuItems.forEach((item) => item.classList.remove("active"));

    // Add active class to clicked item
    const activeItem = document.querySelector(`[data-page="${pageName}"]`);
    if (activeItem) {
        activeItem.classList.add("active");
    }

    // Load the page
    iframe.src = pageName;

    iframe.onload = () => {
        loading.style.display = "none";

        // Inject draggable functionality into iframe
        try {
            const iframeDoc =
                iframe.contentDocument || iframe.contentWindow.document;

            // Add draggable script to iframe
            const script = iframeDoc.createElement("script");
            script.textContent = `
                        (function() {
                            // Find all UI panels
                            const panels = document.querySelectorAll('.info, .controls, .stats, .ui-panel, .overlay');
                            
                            panels.forEach(panel => {
                                // Add draggable attribute
                                panel.style.cursor = 'move';
                                panel.style.userSelect = 'none';
                                
                                // Remove any auto-positioning styles that might interfere
                                const computedStyle = window.getComputedStyle(panel);
                                if (computedStyle.position === 'absolute' || computedStyle.position === 'fixed') {
                                    // Store original position
                                    const rect = panel.getBoundingClientRect();
                                    panel.style.position = 'fixed';
                                    panel.style.left = rect.left + 'px';
                                    panel.style.top = rect.top + 'px';
                                    panel.style.right = 'auto';
                                    panel.style.bottom = 'auto';
                                    panel.style.transform = 'none';
                                }
                                
                                // Add minimize button
                                const minimizeBtn = document.createElement('button');
                                minimizeBtn.textContent = '−';
                                minimizeBtn.style.cssText = \`
                                    position: absolute;
                                    top: 5px;
                                    right: 5px;
                                    width: 20px;
                                    height: 20px;
                                    background: #00ff41;
                                    color: #0a0e27;
                                    border: none;
                                    border-radius: 3px;
                                    cursor: pointer;
                                    font-weight: bold;
                                    font-size: 16px;
                                    line-height: 1;
                                    padding: 0;
                                    z-index: 1000;
                                \`;
                                
                                panel.style.position = 'fixed';
                                panel.appendChild(minimizeBtn);
                                
                                let originalContent = null;
                                let isMinimized = false;
                                
                                minimizeBtn.addEventListener('click', (e) => {
                                    e.stopPropagation();
                                    isMinimized = !isMinimized;
                                    
                                    if (isMinimized) {
                                        originalContent = Array.from(panel.children).filter(child => child !== minimizeBtn);
                                        originalContent.forEach(child => child.style.display = 'none');
                                        minimizeBtn.textContent = '+';
                                        panel.style.padding = '5px';
                                        panel.style.minWidth = '30px';
                                    } else {
                                        originalContent.forEach(child => child.style.display = '');
                                        minimizeBtn.textContent = '−';
                                        panel.style.padding = '';
                                        panel.style.minWidth = '';
                                    }
                                });
                                
                                let isDragging = false;
                                let currentX;
                                let currentY;
                                let initialX;
                                let initialY;
                                let xOffset = 0;
                                let yOffset = 0;
                                
                                // Get initial position
                                const rect = panel.getBoundingClientRect();
                                xOffset = rect.left;
                                yOffset = rect.top;
                                
                                panel.addEventListener('mousedown', dragStart);
                                document.addEventListener('mousemove', drag);
                                document.addEventListener('mouseup', dragEnd);
                                
                                function dragStart(e) {
                                    if (e.target === minimizeBtn) return;
                                    
                                    // Don't drag if interacting with input elements
                                    if (e.target.tagName === 'INPUT' || 
                                        e.target.tagName === 'BUTTON' || 
                                        e.target.tagName === 'SELECT' ||
                                        e.target.tagName === 'TEXTAREA' ||
                                        e.target.tagName === 'A') {
                                        return;
                                    }
                                    
                                    initialX = e.clientX - xOffset;
                                    initialY = e.clientY - yOffset;
                                    
                                    if (e.target === panel || panel.contains(e.target)) {
                                        isDragging = true;
                                        panel.style.transition = 'none';
                                    }
                                }
                                
                                function drag(e) {
                                    if (isDragging) {
                                        e.preventDefault();
                                        
                                        currentX = e.clientX - initialX;
                                        currentY = e.clientY - initialY;
                                        
                                        xOffset = currentX;
                                        yOffset = currentY;
                                        
                                        setTranslate(currentX, currentY, panel);
                                    }
                                }
                                
                                function dragEnd(e) {
                                    initialX = currentX;
                                    initialY = currentY;
                                    isDragging = false;
                                }
                                
                                function setTranslate(xPos, yPos, el) {
                                    el.style.left = xPos + 'px';
                                    el.style.top = yPos + 'px';
                                }
                            });
                            
                            // Add keyboard shortcut to hide all panels
                            document.addEventListener('keydown', (e) => {
                                if (e.key === 'h' || e.key === 'H') {
                                    panels.forEach(panel => {
                                        panel.style.display = panel.style.display === 'none' ? '' : 'none';
                                    });
                                }
                            });
                        })();
                    `;
            iframeDoc.body.appendChild(script);

            // Add style for better UI
            const style = iframeDoc.createElement("style");
            style.textContent = `
                        .info, .controls, .stats, .ui-panel, .overlay {
                            box-shadow: 0 4px 12px rgba(0, 255, 65, 0.3) !important;
                            transition: box-shadow 0.3s !important;
                        }
                        .info:hover, .controls:hover, .stats:hover, .ui-panel:hover, .overlay:hover {
                            box-shadow: 0 6px 20px rgba(0, 255, 65, 0.5) !important;
                        }
                    `;
            iframeDoc.head.appendChild(style);
        } catch (error) {
            console.log(
                "Could not inject draggable script (cross-origin restriction)"
            );
        }
    };
}

menuItems.forEach((item) => {
    item.addEventListener("click", () => {
        const page = item.getAttribute("data-page");
        loadPage(page);
    });
});

// Load home page by default
loadPage("./pages/home.html");