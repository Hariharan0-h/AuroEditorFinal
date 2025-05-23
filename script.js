class CanvasEditor {
    constructor() {
        this.canvas = null;
        this.currentZoom = 100;
        this.contextMenuTarget = null;
        this.tableSelection = {
            rows: 0,
            cols: 0
        };

        this.pageBorder = {
            enabled: false,
            width: 1,
            style: 'solid',
            color: '#000000',
            padding: {
                top: 10,
                right: 10,
                bottom: 10,
                left: 10
            }
        };
        
        this.textProps = {
            bold: false,
            italic: false,
            underline: false,
            color: '#000000',
            bulletList: false,
            numberList: false
        };
        
        // Multiple pages support
        this.pages = [];
        this.currentPageIndex = 0;
        
        this.init();
    }
    
    init() {
        this.initCanvas();
        this.initEventListeners();
        this.initTableGrid();
        this.initFieldModal();
        
        setTimeout(() => {
            this.addTextbox();
            this.loadProject();
        }, 100);
    }
    
    initFieldModal() {
        const fieldItems = document.querySelectorAll('.field-item');
        
        // Add click event to all field items
        fieldItems.forEach(item => {
            item.addEventListener('click', () => {
                const fieldType = item.getAttribute('data-field');
                this.insertField(fieldType);
                this.closeModal('field-modal');
                this.showNotification(`Field {{${fieldType}}} inserted`);
            });
        });
    }

    initCanvas() {
        const a4Width = 794;
        const a4Height = 1123;

        this.canvas = new fabric.Canvas('editorCanvas', {
            preserveObjectStacking: true,
            stopContextMenu: true,
            selection: true
        });
        
        this.canvas.setWidth(a4Width);
        this.canvas.setHeight(a4Height);
        
        this.canvas.on('selection:created', e => this.onSelectionChange(e));
        this.canvas.on('selection:updated', e => this.onSelectionChange(e));
        this.canvas.on('selection:cleared', () => this.onSelectionCleared());
        this.canvas.on('mouse:move', e => this.updateCursorPosition(e));
        this.canvas.on('mouse:down', e => this.handleCanvasClick(e));
    }
    
    initEventListeners() {
        document.addEventListener('contextmenu', e => e.preventDefault());
        
        document.getElementById('add-text-btn').addEventListener('click', () => this.addTextbox());
        document.getElementById('add-image-btn').addEventListener('click', () => this.openModal('image-modal'));
        document.getElementById('add-table-btn').addEventListener('click', () => this.toggleTableGrid());
        
        // Change the insert field button to open the modal instead of showing dropdown
        document.getElementById('insert-field-btn').addEventListener('click', () => this.openModal('field-modal'));
        
        // Rest of the event listeners remain the same
        document.getElementById('add-square-btn').addEventListener('click', () => this.addShape('square'));
        document.getElementById('add-circle-btn').addEventListener('click', () => this.addShape('circle'));
        document.getElementById('add-vline-btn').addEventListener('click', () => this.addShape('vline'));
        document.getElementById('add-hline-btn').addEventListener('click', () => this.addShape('hline'));
        
        document.getElementById('bullet-list-btn').addEventListener('click', () => this.toggleListFormat('bullet'));
        document.getElementById('number-list-btn').addEventListener('click', () => this.toggleListFormat('number'));

        document.getElementById('bold-btn').addEventListener('click', () => this.toggleFormat('bold'));
        document.getElementById('italic-btn').addEventListener('click', () => this.toggleFormat('italic'));
        document.getElementById('underline-btn').addEventListener('click', () => this.toggleFormat('underline'));

        document.getElementById('page-border-btn').addEventListener('click', () => this.openModal('border-modal'));
        document.getElementById('apply-border-btn').addEventListener('click', () => this.applyPageBorder());
        
        // Update border color picker
        const borderColorPicker = document.getElementById('border-color');
        borderColorPicker.addEventListener('input', e => {
            document.getElementById('border-color-display').style.backgroundColor = e.target.value;
        });
        
        // Set initial color display
        document.getElementById('border-color-display').style.backgroundColor = '#000000';
        
        const colorPicker = document.getElementById('color-picker');
        colorPicker.addEventListener('input', e => this.setTextColor(e.target.value));
        colorPicker.addEventListener('change', e => this.setTextColor(e.target.value));
        
        document.getElementById('font-size-select').addEventListener('change', e => {
            this.setFontSize(parseInt(e.target.value));
        });
        
        document.getElementById('font-family-select').addEventListener('change', e => {
            this.setFontFamily(e.target.value);
        });
    
        document.getElementById('align-left-btn').addEventListener('click', () => this.alignText('left'));
        document.getElementById('align-center-btn').addEventListener('click', () => this.alignText('center'));
        document.getElementById('align-right-btn').addEventListener('click', () => this.alignText('right'));
        
        document.getElementById('duplicate-btn').addEventListener('click', () => this.duplicateSelected());
        document.getElementById('delete-btn').addEventListener('click', () => this.deleteSelected());
        
        document.getElementById('zoom-in-btn').addEventListener('click', () => this.changeZoom(10));
        document.getElementById('zoom-out-btn').addEventListener('click', () => this.changeZoom(-10));
        
        // Event listeners for all modals including the new field modal
        document.querySelectorAll('.close-modal, .btn-secondary[data-modal]').forEach(button => {
            button.addEventListener('click', () => {
                const modalId = button.getAttribute('data-modal');
                this.closeModal(modalId);
            });
        });
        
        document.getElementById('upload-image-btn').addEventListener('click', () => this.uploadImage());
        
        document.getElementById('save-btn').addEventListener('click', () => this.saveProject());
        document.getElementById('export-btn').addEventListener('click', () => this.openModal('export-modal'));
        document.getElementById('export-format').addEventListener('change', e => this.updateExportDetails(e.target.value));
        document.getElementById('download-btn').addEventListener('click', () => this.downloadExport());
        
        document.addEventListener('click', e => {
            if (!e.target.closest('#context-menu')) {
                this.hideContextMenu();
            }
        });
        
        document.getElementById('context-duplicate').addEventListener('click', () => this.duplicateContextItem());
        document.getElementById('context-edit').addEventListener('click', () => this.editContextItem());
        document.getElementById('context-front').addEventListener('click', () => this.bringToFront());
        document.getElementById('context-back').addEventListener('click', () => this.sendToBack());
        document.getElementById('context-delete').addEventListener('click', () => this.deleteContextItem());
        
        this.canvas.on('mouse:down', e => this.handleContextMenu(e));
        
        // Add page controls event listeners
        document.getElementById('add-page-btn').addEventListener('click', () => this.addNewPage());
        document.getElementById('prev-page-btn').addEventListener('click', () => this.navigatePage(-1));
        document.getElementById('next-page-btn').addEventListener('click', () => this.navigatePage(1));
    }
    
    // Save current page to pages array
    saveCurrentPage() {
        if (this.currentPageIndex >= 0 && this.currentPageIndex < this.pages.length) {
            const pageData = this.canvas.toJSON(['name']);
            // Add border properties
            pageData.pageBorder = this.pageBorder;
            this.pages[this.currentPageIndex] = pageData;
        } else {
            // If this is the first page being saved
            const pageData = this.canvas.toJSON(['name']);
            // Add border properties
            pageData.pageBorder = this.pageBorder;
            this.pages.push(pageData);
        }
    }
    
    // Add a new page
    addNewPage() {
        // Save current page
        this.saveCurrentPage();
        
        // Create a new empty page
        const newPageIndex = this.pages.length;
        
        // Create a blank canvas for the new page
        this.canvas.clear();
        
        // Reset page border for new page (can be inherited from current page if needed)
        this.pageBorder = {
            enabled: false,
            width: 1,
            style: 'solid',
            color: '#000000',
            padding: {
                top: 10,
                right: 10,
                bottom: 10,
                left: 10
            }
        };
        
        // Add the blank page to the pages array
        const pageData = this.canvas.toJSON(['name']);
        pageData.pageBorder = this.pageBorder;
        this.pages.push(pageData);
        
        // Update current page index
        this.currentPageIndex = newPageIndex;
        
        // Update page indicator
        this.updatePageIndicator();
        
        this.showNotification('New page added');
    }

    applyPageBorder() {
        // Get border settings from inputs
        const width = parseInt(document.getElementById('border-width').value);
        const style = document.getElementById('border-style').value;
        const color = document.getElementById('border-color').value;
        
        // Get padding values
        const paddingTop = parseInt(document.getElementById('padding-top').value) || 0;
        const paddingRight = parseInt(document.getElementById('padding-right').value) || 0;
        const paddingBottom = parseInt(document.getElementById('padding-bottom').value) || 0;
        const paddingLeft = parseInt(document.getElementById('padding-left').value) || 0;
        
        // Update border properties
        this.pageBorder = {
            enabled: true,
            width,
            style,
            color,
            padding: {
                top: paddingTop,
                right: paddingRight,
                bottom: paddingBottom,
                left: paddingLeft
            }
        };
        
        // Apply border to canvas
        this.renderPageBorder();
        
        // Close the modal
        this.closeModal('border-modal');
        this.showNotification('Page border applied');
    }

    renderPageBorder() {
        // Remove existing border if any
        this.removePageBorder();
        
        if (!this.pageBorder.enabled) return;
        
        const width = this.canvas.width;
        const height = this.canvas.height;
        const border = this.pageBorder;
        const padding = border.padding || { top: 0, right: 0, bottom: 0, left: 0 };
        
        // Create border as a rect with no fill, accounting for padding
        const borderRect = new fabric.Rect({
            left: padding.left + (border.width / 2),
            top: padding.top + (border.width / 2),
            width: width - padding.left - padding.right - border.width,
            height: height - padding.top - padding.bottom - border.width,
            fill: 'transparent',
            stroke: border.color,
            strokeWidth: border.width,
            strokeDashArray: border.style === 'dashed' ? [10, 5] : 
                            border.style === 'dotted' ? [2, 3] :
                            border.style === 'double' ? [1, 0] : null,
            selectable: false,
            evented: false,
            name: 'pageBorder'
        });
        
        // Add to canvas
        this.canvas.add(borderRect);
        
        // Send to back so it doesn't overlap with content
        this.canvas.sendToBack(borderRect);
        
        // Render the changes
        this.canvas.renderAll();
    }
    
    // Add method to remove the page border
    removePageBorder() {
        // Find and remove border object
        const objects = this.canvas.getObjects();
        for (let i = 0; i < objects.length; i++) {
            if (objects[i].name === 'pageBorder') {
                this.canvas.remove(objects[i]);
                break;
            }
        }
    }
    
    // Add method to render the page border
    renderPageBorder() {
        // Remove existing border if any
        this.removePageBorder();
        
        if (!this.pageBorder.enabled) return;
        
        const width = this.canvas.width;
        const height = this.canvas.height;
        const border = this.pageBorder;
        
        // Create border as a rect with no fill
        const borderRect = new fabric.Rect({
            left: border.width / 2,
            top: border.width / 2,
            width: width - border.width,
            height: height - border.width,
            fill: 'transparent',
            stroke: border.color,
            strokeWidth: border.width,
            strokeDashArray: border.style === 'dashed' ? [10, 5] : 
                            border.style === 'dotted' ? [2, 3] :
                            border.style === 'double' ? [1, 0] : null,
            selectable: false,
            evented: false,
            name: 'pageBorder'
        });
        
        // Add to canvas
        this.canvas.add(borderRect);
        
        // Send to back so it doesn't overlap with content
        this.canvas.sendToBack(borderRect);
        
        // Render the changes
        this.canvas.renderAll();
    }
    
    // Add method to remove the page border
    removePageBorder() {
        // Find and remove border object
        const objects = this.canvas.getObjects();
        for (let i = 0; i < objects.length; i++) {
            if (objects[i].name === 'pageBorder') {
                this.canvas.remove(objects[i]);
                break;
            }
        }
    }
    
    // Navigate to the previous or next page
    navigatePage(direction) {
        const newPageIndex = this.currentPageIndex + direction;
        
        // Check if the new index is valid
        if (newPageIndex >= 0 && newPageIndex < this.pages.length) {
            // Save current page
            this.saveCurrentPage();
            
            // Load the target page
            this.canvas.loadFromJSON(this.pages[newPageIndex], () => {
                // Get border settings from the loaded page
                if (this.pages[newPageIndex].pageBorder) {
                    this.pageBorder = this.pages[newPageIndex].pageBorder;
                    
                    // Apply border if enabled
                    if (this.pageBorder.enabled) {
                        this.renderPageBorder();
                    }
                }
                
                this.canvas.renderAll();
            });
            
            // Update current page index
            this.currentPageIndex = newPageIndex;
            
            // Update page indicator
            this.updatePageIndicator();
            
            this.showNotification(`Navigated to page ${newPageIndex + 1}`);
        }
    }
    
    // Update the page indicator in the UI
    updatePageIndicator() {
        document.getElementById('current-page').textContent = this.currentPageIndex + 1;
        document.getElementById('total-pages').textContent = this.pages.length;
        
        // Enable/disable navigation buttons
        document.getElementById('prev-page-btn').disabled = (this.currentPageIndex === 0);
        document.getElementById('next-page-btn').disabled = (this.currentPageIndex === this.pages.length - 1);
    }

    toggleListFormat(format) {
        const activeObject = this.canvas.getActiveObject();
        if (!activeObject || activeObject.type !== 'textbox') return;
        
        // Get the current text
        let text = activeObject.text;
        const lines = text.split('\n');
        let formattedLines = [];
        
        // Check if format is already applied (simple check)
        const isAlreadyFormatted = (format === 'bullet') ? 
            lines[0].startsWith('• ') : 
            lines[0].match(/^\d+\.\s/);
        
        if (isAlreadyFormatted) {
            // Remove formatting
            formattedLines = lines.map(line => {
                if (format === 'bullet') {
                    return line.startsWith('• ') ? line.substring(2) : line;
                } else {
                    return line.replace(/^\d+\.\s/, '');
                }
            });
            
            // Update button state
            if (format === 'bullet') {
                this.textProps.bulletList = false;
                document.getElementById('bullet-list-btn').classList.remove('active');
            } else {
                this.textProps.numberList = false;
                document.getElementById('number-list-btn').classList.remove('active');
            }
        } else {
            // Apply formatting
            formattedLines = lines.map((line, index) => {
                // Remove any existing formatting first
                let cleanLine = line;
                if (cleanLine.startsWith('• ')) {
                    cleanLine = cleanLine.substring(2);
                } else {
                    cleanLine = cleanLine.replace(/^\d+\.\s/, '');
                }
                
                // Apply new formatting
                if (format === 'bullet') {
                    return cleanLine ? `• ${cleanLine}` : cleanLine;
                } else {
                    return cleanLine ? `${index + 1}. ${cleanLine}` : cleanLine;
                }
            });
            
            // Update button state and deactivate the other list format
            if (format === 'bullet') {
                this.textProps.bulletList = true;
                this.textProps.numberList = false;
                document.getElementById('bullet-list-btn').classList.add('active');
                document.getElementById('number-list-btn').classList.remove('active');
            } else {
                this.textProps.numberList = true;
                this.textProps.bulletList = false;
                document.getElementById('number-list-btn').classList.add('active');
                document.getElementById('bullet-list-btn').classList.remove('active');
            }
        }
        
        // Update the text object
        activeObject.set('text', formattedLines.join('\n'));
        this.canvas.renderAll();
        
        // Show notification
        const formatName = format === 'bullet' ? 'bullet list' : 'numbered list';
        this.showNotification(`${formatName} formatting ${isAlreadyFormatted ? 'removed' : 'applied'}`);
    }
    
    initTableGrid() {
        const gridContainer = document.querySelector('.grid-container');
        gridContainer.innerHTML = '';
        
        for (let i = 0; i < 100; i++) {
            const cell = document.createElement('div');
            cell.className = 'grid-cell';
            
            cell.addEventListener('mouseover', () => {
                const row = Math.floor(i / 10) + 1;
                const col = (i % 10) + 1;
                this.highlightGrid(row, col);
                this.tableSelection.rows = row;
                this.tableSelection.cols = col;
                document.querySelector('.dimension-display').textContent = `${row} x ${col}`;
            });
            
            cell.addEventListener('click', () => {
                const row = Math.floor(i / 10) + 1;
                const col = (i % 10) + 1;
                this.insertTable(row, col);
                document.getElementById('table-grid').style.display = 'none';
            });
            
            gridContainer.appendChild(cell);
        }
    }
    
    insertField(fieldType) {
        const activeObject = this.canvas.getActiveObject();
        
        if (!activeObject || activeObject.type !== 'textbox') {
            const fieldTag = `{{${fieldType}}}`;
            
            const textbox = new fabric.Textbox(fieldTag, {
                left: this.canvas.width / 2 - 50,
                top: this.canvas.height / 2 - 25,
                width: 200,
                fontSize: 18,
                fontFamily: 'Inter',
                fill: '#1976d2',
                padding: 10,
                cornerColor: '#4361ee',
                cornerSize: 6,
                transparentCorners: false,
                borderColor: '#4361ee',
                centeredScaling: true,
                editable: true
            });
            
            this.canvas.add(textbox);
            this.canvas.setActiveObject(textbox);
            this.showNotification(`Field {{${fieldType}}} inserted`);
            return;
        }
        
        const fieldTag = `{{${fieldType}}}`;
        const cursorPos = activeObject.selectionStart || 0;
        
        const currentText = activeObject.text;
        const newText = currentText.slice(0, cursorPos) + fieldTag + currentText.slice(cursorPos);
        
        activeObject.set({
            text: newText
        });
        
        activeObject.selectionStart = cursorPos + fieldTag.length;
        activeObject.selectionEnd = cursorPos + fieldTag.length;
        
        this.canvas.renderAll();
        this.showNotification(`Field {{${fieldType}}} inserted`);
    }
    
    setFontSize(size) {
        const activeObject = this.canvas.getActiveObject();
        if (!activeObject || activeObject.type !== 'textbox') return;
        
        activeObject.set('fontSize', size);
        this.canvas.renderAll();
        this.showNotification(`Font size set to ${size}px`);
    }
    
    setFontFamily(fontFamily) {
        const activeObject = this.canvas.getActiveObject();
        if (!activeObject || activeObject.type !== 'textbox') return;
        
        activeObject.set('fontFamily', fontFamily);
        this.canvas.renderAll();
        this.showNotification(`Font changed to ${fontFamily}`);
    }
    
    onSelectionChange(e) {
        const selected = e.selected[0];
        const textControls = document.querySelector('.text-controls');
        
        if (selected && selected.type === 'textbox') {
            textControls.style.display = 'flex';
            
            document.getElementById('bold-btn').classList.toggle('active', !!selected.fontWeight && selected.fontWeight >= 'bold');
            document.getElementById('italic-btn').classList.toggle('active', !!selected.fontStyle && selected.fontStyle === 'italic');
            document.getElementById('underline-btn').classList.toggle('active', !!selected.underline);
            
            const color = selected.fill || '#000000';
            const lines = selected.text.split('\n');
            const hasBullets = lines.length > 0 && lines[0].startsWith('• ');
            const hasNumbers = lines.length > 0 && !!lines[0].match(/^\d+\.\s/);

            document.getElementById('bullet-list-btn').classList.toggle('active', hasBullets);
            document.getElementById('number-list-btn').classList.toggle('active', hasNumbers);

            this.textProps.bulletList = hasBullets;
            this.textProps.numberList = hasNumbers;

            document.getElementById('color-display').style.backgroundColor = color;
            document.getElementById('color-picker').value = color;
            
            if (selected.fontSize) {
                document.getElementById('font-size-select').value = selected.fontSize;
            }
            
            if (selected.fontFamily) {
                document.getElementById('font-family-select').value = selected.fontFamily;
            }
            
            this.textProps = {
                bold: !!selected.fontWeight && selected.fontWeight >= 'bold',
                italic: !!selected.fontStyle && selected.fontStyle === 'italic',
                underline: !!selected.underline,
                color: color
            };
            
            document.getElementById('align-left-btn').classList.toggle('active', selected.textAlign === 'left' || !selected.textAlign);
            document.getElementById('align-center-btn').classList.toggle('active', selected.textAlign === 'center');
            document.getElementById('align-right-btn').classList.toggle('active', selected.textAlign === 'right');
        } else {
            textControls.style.display = 'none';
        }
        
        document.getElementById('object-info').textContent = selected ? `${selected.type} selected` : 'No selection';
    }
    
    onSelectionCleared() {
        document.querySelector('.text-controls').style.display = 'none';
        document.getElementById('object-info').textContent = 'No selection';
    }
    
    updateCursorPosition(options) {
        const pointer = this.canvas.getPointer(options.e);
        document.getElementById('cursor-position').textContent = 
            `x: ${Math.round(pointer.x)}, y: ${Math.round(pointer.y)}`;
    }
    
    handleCanvasClick(options) {
        this.hideContextMenu();
    }
    
    handleContextMenu(options) {
        if (options.e.button === 2) {
            const pointer = this.canvas.getPointer(options.e);
            const objects = this.canvas.getObjects();
            
            for (let i = objects.length - 1; i >= 0; i--) {
                if (objects[i].containsPoint(pointer)) {
                    options.e.preventDefault();
                    this.canvas.setActiveObject(objects[i]);
                    this.showContextMenu(options.e.clientX, options.e.clientY, objects[i]);
                    this.contextMenuTarget = objects[i];
                    return;
                }
            }
            
            this.hideContextMenu();
        }
    }
    
    showContextMenu(x, y, target) {
        const contextMenu = document.getElementById('context-menu');
        contextMenu.style.display = 'block';
        contextMenu.style.left = `${x}px`;
        contextMenu.style.top = `${y}px`;
    }
    
    hideContextMenu() {
        document.getElementById('context-menu').style.display = 'none';
        this.contextMenuTarget = null;
    }
    
    toggleFormat(format) {
        const activeObject = this.canvas.getActiveObject();
        if (!activeObject || activeObject.type !== 'textbox') return;
        
        switch (format) {
            case 'bold':
                const newWeight = activeObject.fontWeight === 'bold' ? 'normal' : 'bold';
                activeObject.set('fontWeight', newWeight);
                document.getElementById('bold-btn').classList.toggle('active', newWeight === 'bold');
                break;
                
            case 'italic':
                const newStyle = activeObject.fontStyle === 'italic' ? 'normal' : 'italic';
                activeObject.set('fontStyle', newStyle);
                document.getElementById('italic-btn').classList.toggle('active', newStyle === 'italic');
                break;
                
            case 'underline':
                const newUnderline = !activeObject.underline;
                activeObject.set('underline', newUnderline);
                document.getElementById('underline-btn').classList.toggle('active', newUnderline);
                break;
        }
        
        this.canvas.renderAll();
        this.showNotification(`${format} formatting toggled`);
    }
    
    setTextColor(color) {
        const activeObject = this.canvas.getActiveObject();
        if (!activeObject || activeObject.type !== 'textbox') return;
        
        activeObject.set({
            fill: color
        });
        
        document.getElementById('color-display').style.backgroundColor = color;
        this.textProps.color = color;
        this.canvas.renderAll();
        this.showNotification('Text color changed');
    }
    
    alignText(alignment) {
        const activeObject = this.canvas.getActiveObject();
        if (!activeObject || activeObject.type !== 'textbox') return;
        
        activeObject.set('textAlign', alignment);
        
        document.getElementById('align-left-btn').classList.toggle('active', alignment === 'left');
        document.getElementById('align-center-btn').classList.toggle('active', alignment === 'center');
        document.getElementById('align-right-btn').classList.toggle('active', alignment === 'right');
        
        this.canvas.renderAll();
        this.showNotification(`Text aligned ${alignment}`);
    }
    
    addTextbox() {
        const textbox = new fabric.Textbox('Type here...', {
            left: this.canvas.width / 2 - 150,
            top: this.canvas.height / 2 - 25,
            width: 300,
            fontSize: 18,
            fontFamily: 'Inter',
            fill: '#343a40',
            padding: 10,
            cornerColor: '#4361ee',
            cornerSize: 6,
            transparentCorners: false,
            borderColor: '#4361ee',
            centeredScaling: true,
            editable: true,
            fontWeight: 'normal',
            fontStyle: 'normal',
            underline: false,
            textAlign: 'left',
            bulletList: false,
            numberList: false
        });
        
        this.canvas.add(textbox);
        this.canvas.setActiveObject(textbox);
        document.querySelector('.text-controls').style.display = 'flex';
        this.showNotification('Text box added');
    }
    
    addShape(shape) {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        let obj;
        
        switch (shape) {
            case 'square':
                obj = new fabric.Rect({
                    left: centerX - 40,
                    top: centerY - 40,
                    width: 80,
                    height: 80,
                    fill: '#4361ee',
                    opacity: 0.8,
                    stroke: '#3f37c9',
                    strokeWidth: 1
                });
                break;
                
            case 'circle':
                obj = new fabric.Circle({
                    left: centerX - 40,
                    top: centerY - 40,
                    radius: 40,
                    fill: '#4895ef',
                    opacity: 0.8,
                    stroke: '#3f37c9',
                    strokeWidth: 1
                });
                break;
                
            case 'vline':
                obj = new fabric.Line([0, 0, 0, 100], {
                    left: centerX,
                    top: centerY - 50,
                    stroke: '#212529',
                    strokeWidth: 2
                });
                break;
                
            case 'hline':
                obj = new fabric.Line([0, 0, 100, 0], {
                    left: centerX - 50,
                    top: centerY,
                    stroke: '#212529',
                    strokeWidth: 2
                });
                break;
        }
        
        if (obj) {
            this.canvas.add(obj);
            this.canvas.setActiveObject(obj);
            this.showNotification(`${shape} added`);
        }
    }
    
    toggleTableGrid() {
        const grid = document.getElementById('table-grid');
        grid.style.display = grid.style.display === 'none' ? 'block' : 'none';
    }
    
    highlightGrid(rows, cols) {
        const cells = document.querySelectorAll('.grid-cell');
        cells.forEach((cell, idx) => {
            const r = Math.floor(idx / 10) + 1;
            const c = (idx % 10) + 1;
            cell.classList.toggle('selected', r <= rows && c <= cols);
        });
    }
    
    insertTable(rows, cols) {
        const tableWidth = 400;
        const cellWidth = tableWidth / cols;
        const cellHeight = 30;
        const tableHeight = rows * cellHeight;
        
        // Create a group to hold all cells
        const cellObjects = [];
        
        // Create individual cells instead of a rigid table structure
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                // Cell background (rectangle)
                const cellRect = new fabric.Rect({
                    left: c * cellWidth,
                    top: r * cellHeight,
                    width: cellWidth,
                    height: cellHeight,
                    fill: 'white',
                    stroke: '#343a40',
                    strokeWidth: 1,
                    selectable: false
                });
                
                // Cell text (editable)
                const cellText = new fabric.Textbox('', {
                    left: c * cellWidth + 2,
                    top: r * cellHeight + 2,
                    width: cellWidth - 4,
                    height: cellHeight - 4,
                    fontSize: 14,
                    fontFamily: 'Inter',
                    fill: '#343a40',
                    editable: true,
                    selectable: true
                });
                
                // Create a cell group (background + text)
                const cellGroup = new fabric.Group([cellRect, cellText], {
                    left: c * cellWidth,
                    top: r * cellHeight,
                    subTargetCheck: true,
                    interactive: true,
                    hasControls: true,
                    hasBorders: true,
                    borderColor: '#4361ee',
                    cornerColor: '#4361ee',
                    cornerSize: 6,
                    transparentCorners: false,
                    lockMovementX: true,
                    lockMovementY: true
                });
                
                // Enable editing of the cell's text when selected
                cellGroup.on('selected', () => {
                    this.canvas.setActiveObject(cellText);
                    cellText.enterEditing();
                    cellText.selectAll();
                });
                
                cellObjects.push(cellGroup);
            }
        }
        
        // Create a table container group that will hold all cells
        const tableContainer = new fabric.Group([], {
            left: this.canvas.width / 2 - tableWidth / 2,
            top: this.canvas.height / 2 - tableHeight / 2,
            width: tableWidth,
            height: tableHeight,
            subTargetCheck: true,
            hasControls: true,
            hasBorders: true,
            borderColor: '#4361ee',
            cornerColor: '#4361ee',
            cornerSize: 6,
            transparentCorners: false
        });
        
        // Add all cell groups to the table container
        cellObjects.forEach(cell => {
            tableContainer.addWithUpdate(cell);
        });
        
        // Make cells independently selectable by adding them to canvas directly
        // but position them relative to the table container
        this.canvas.add(tableContainer);
        
        // Add ability to resize columns by dragging
        this.makeTableResizable(tableContainer, rows, cols, cellWidth, cellHeight);
        
        this.canvas.setActiveObject(tableContainer);
        this.showNotification(`${rows}x${cols} editable table added`);
    }

    makeTableResizable(tableContainer, rows, cols, initialCellWidth, cellHeight) {
        // Add vertical resize handles between columns
        for (let c = 1; c < cols; c++) {
            const x = c * initialCellWidth;
            
            const resizeHandle = new fabric.Rect({
                left: x - 2,
                top: 0,
                width: 4,
                height: rows * cellHeight,
                fill: 'rgba(67, 97, 238, 0.3)',
                stroke: 'rgba(67, 97, 238, 0.5)',
                strokeWidth: 1,
                opacity: 0,
                selectable: true,
                hasBorders: false,
                hasControls: false,
                hoverCursor: 'col-resize',
                excludeFromExport: true,
                // Store the column index and original position
                data: {
                    columnIndex: c,
                    originalX: x
                }
            });
            
            // Add hover effect
            resizeHandle.on('mouseover', () => {
                resizeHandle.set('opacity', 1);
                this.canvas.renderAll();
            });
            
            resizeHandle.on('mouseout', () => {
                resizeHandle.set('opacity', 0);
                this.canvas.renderAll();
            });
            
            // Add resize functionality
            resizeHandle.on('mousedown', (e) => {
                // Store initial positions
                const startX = e.pointer.x;
                const columnIndex = resizeHandle.data.columnIndex;
                const originalX = resizeHandle.data.originalX;
                
                // Setup mouse move handler
                const mouseMoveHandler = (e) => {
                    const currentX = e.pointer.x;
                    const deltaX = currentX - startX;
                    
                    // Update position of the resize handle
                    resizeHandle.set({
                        left: originalX + deltaX - 2
                    });
                    
                    // Update the cells on either side of this column divider
                    this.updateColumnWidths(tableContainer, columnIndex, deltaX);
                    
                    this.canvas.renderAll();
                };
                
                // Setup mouse up handler to remove event listeners
                const mouseUpHandler = () => {
                    this.canvas.off('mouse:move', mouseMoveHandler);
                    this.canvas.off('mouse:up', mouseUpHandler);
                };
                
                // Add temporary event listeners for dragging
                this.canvas.on('mouse:move', mouseMoveHandler);
                this.canvas.on('mouse:up', mouseUpHandler);
            });
            
            // Add the resize handle to the canvas, positioned relative to the table
            this.canvas.add(resizeHandle);
            resizeHandle.set({
                left: tableContainer.left + x - 2,
                top: tableContainer.top
            });
        }
    }

    updateColumnWidths(tableContainer, columnIndex, deltaX) {
        // Get all the cell groups in the table
        const cellGroups = tableContainer.getObjects('group');
        
        // Update each cell in the affected columns
        cellGroups.forEach(cellGroup => {
            const cellRect = cellGroup.getObjects('rect')[0];
            const cellText = cellGroup.getObjects('textbox')[0];
            
            // Calculate the cell's column based on its position
            const cellCol = Math.round(cellGroup.left / cellRect.width);
            
            // Only update cells to the right of the column divider being dragged
            if (cellCol === columnIndex - 1) {
                // Expand/contract the cell to the left of the divider
                cellRect.set('width', cellRect.width + deltaX);
                cellText.set('width', cellRect.width - 4);
                cellGroup.addWithUpdate();
            } else if (cellCol === columnIndex) {
                // Move and resize the cell to the right of the divider
                cellGroup.set('left', cellGroup.left + deltaX);
                cellRect.set('width', cellRect.width - deltaX);
                cellText.set('width', cellRect.width - 4);
                cellGroup.addWithUpdate();
            } else if (cellCol > columnIndex) {
                // Just move cells further to the right
                cellGroup.set('left', cellGroup.left + deltaX);
                cellGroup.addWithUpdate();
            }
        });
        
        // Update table container
        tableContainer.addWithUpdate();
    }
    
    openModal(modalId) {
        document.getElementById(modalId).style.display = 'flex';
        
        if (modalId === 'export-modal') {
            const format = document.getElementById('export-format').value;
            this.updateExportDetails(format);
        }
    }
    
    closeModal(modalId) {
        document.getElementById(modalId).style.display = 'none';
    }
    
    uploadImage() {
        const input = document.getElementById('image-input');
        const file = input.files[0];
        
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                fabric.Image.fromURL(e.target.result, (img) => {
                    const maxSize = 300;
                    const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
                    
                    img.set({
                        left: this.canvas.width / 2 - (img.width * scale) / 2,
                        top: this.canvas.height / 2 - (img.height * scale) / 2,
                        scaleX: scale,
                        scaleY: scale,
                        cornerColor: '#4361ee',
                        cornerSize: 6,
                        transparentCorners: false,
                        borderColor: '#4361ee'
                    });
                    
                    this.canvas.add(img);
                    this.canvas.setActiveObject(img);
                    this.closeModal('image-modal');
                    this.showNotification('Image added to canvas');
                });
            };
            reader.readAsDataURL(file);
        } else {
            this.showNotification('Please select an image', 'warning');
        }
    }
    
    duplicateSelected() {
        const activeObject = this.canvas.getActiveObject();
        if (!activeObject) return;
        
        activeObject.clone((cloned) => {
            cloned.set({
                left: activeObject.left + 20,
                top: activeObject.top + 20,
                evented: true
            });
            this.canvas.add(cloned);
            this.canvas.setActiveObject(cloned);
        });
        
        this.showNotification('Object duplicated');
    }
    
    deleteSelected() {
        const activeObject = this.canvas.getActiveObject();
        if (!activeObject) return;
        
        this.canvas.remove(activeObject);
        this.showNotification('Object deleted');
    }
    
    duplicateContextItem() {
        if (this.contextMenuTarget) {
            this.contextMenuTarget.clone((cloned) => {
                cloned.set({
                    left: this.contextMenuTarget.left + 20,
                    top: this.contextMenuTarget.top + 20,
                    evented: true
                });
                this.canvas.add(cloned);
                this.canvas.setActiveObject(cloned);
            });
            this.hideContextMenu();
            this.showNotification('Object duplicated');
        }
    }
    
    editContextItem() {
        if (this.contextMenuTarget && this.contextMenuTarget.type === 'textbox') {
            this.canvas.setActiveObject(this.contextMenuTarget);
            document.querySelector('.text-controls').style.display = 'flex';
        }
        this.hideContextMenu();
    }
    
    deleteContextItem() {
        if (this.contextMenuTarget) {
            this.canvas.remove(this.contextMenuTarget);
            this.hideContextMenu();
            this.showNotification('Object deleted');
        }
    }
    
    bringToFront() {
        if (this.contextMenuTarget) {
            this.canvas.bringToFront(this.contextMenuTarget);
            this.hideContextMenu();
            this.showNotification('Brought to front');
        }
    }
    
    sendToBack() {
        if (this.contextMenuTarget) {
            this.canvas.sendToBack(this.contextMenuTarget);
            this.hideContextMenu();
            this.showNotification('Sent to back');
        }
    }
    
    changeZoom(delta) {
        this.currentZoom += delta;
        
        // Clamp zoom between 10% and 200%
        this.currentZoom = Math.max(10, Math.min(200, this.currentZoom));
        
        const zoom = this.currentZoom / 100;
        this.canvas.setZoom(zoom);
        
        // Update zoom display
        document.querySelector('.zoom-level').textContent = `${this.currentZoom}%`;
        
        // Update canvas wrapper dimensions to accommodate zoomed canvas
        // This ensures scrollbars appear when needed
        const canvasWrapper = document.querySelector('.canvas-wrapper');
        if (canvasWrapper) {
            const width = this.canvas.width * zoom;
            const height = this.canvas.height * zoom;
            canvasWrapper.style.width = `${width}px`;
            canvasWrapper.style.height = `${height}px`;
        }
    }
    
    saveProject() {
        // Save the current page
        this.saveCurrentPage();
        
        // Create a project data object with all pages
        const projectData = {
            pages: this.pages,
            currentPageIndex: this.currentPageIndex
        };
        
        // Save to localStorage
        localStorage.setItem('canvasEditorProject', JSON.stringify(projectData));
        this.showNotification('Project saved successfully');
    }
    
    loadProject() {
        const savedProject = localStorage.getItem('canvasEditorProject');
        if (savedProject) {
            try {
                // Parse the project data
                const projectData = JSON.parse(savedProject);
                
                // Load pages
                if (projectData.pages && projectData.pages.length > 0) {
                    this.pages = projectData.pages;
                    this.currentPageIndex = projectData.currentPageIndex || 0;
                    
                    // Load the current page
                    this.canvas.loadFromJSON(this.pages[this.currentPageIndex], () => {
                        this.canvas.renderAll();
                        
                        // Initialize page indicator with loaded project data
                        this.updatePageIndicator();
                        
                        this.showNotification('Project loaded from local storage');
                    });
                } else {
                    // If there's no pages data, initialize with current canvas
                    this.pages = [this.canvas.toJSON()];
                    this.currentPageIndex = 0;
                    this.updatePageIndicator();
                }
            } catch (error) {
                this.showNotification('Error loading project', 'error');
                
                // Initialize with current canvas
                this.pages = [this.canvas.toJSON()];
                this.currentPageIndex = 0;
                this.updatePageIndicator();
            }
        } else {
            // No saved project, initialize with current canvas
            this.pages = [this.canvas.toJSON()];
            this.currentPageIndex = 0;
            this.updatePageIndicator();
        }
    }
    
    updateExportDetails(format) {
        const details = document.getElementById('export-details');
        
        switch(format) {
            case 'svg':
                details.value = "SVG format is ideal for vector graphics that can be resized without losing quality. For multi-page projects, only the current page will be exported.";
                break;
            case 'png':
                details.value = "PNG format is a raster image format with lossless compression. For multi-page projects, only the current page will be exported.";
                break;
            case 'json':
                details.value = "JSON format contains the complete project data that can be reopened in this editor. All pages will be included in the export.";
                break;
            case 'html':
                details.value = "HTML format exports the canvas as an HTML document viewable in any browser. For multi-page projects, only the current page will be exported.";
                break;
        }
    }
    
    downloadExport() {
        const format = document.getElementById('export-format').value;
        let data, filename, mime;
        
        // Make sure current page is saved
        this.saveCurrentPage();
        
        switch(format) {
            case 'svg':
                data = this.canvas.toSVG();
                filename = `canvas-export-page${this.currentPageIndex + 1}.svg`;
                mime = 'image/svg+xml';
                break;
            case 'png':
                data = this.canvas.toDataURL({format: 'png'});
                filename = `canvas-export-page${this.currentPageIndex + 1}.png`;
                mime = 'image/png';
                break;
            case 'json':
                // Export all pages
                const projectData = {
                    pages: this.pages,
                    currentPageIndex: this.currentPageIndex
                };
                data = JSON.stringify(projectData);
                filename = 'canvas-project-all-pages.json';
                mime = 'application/json';
                break;
            case 'html':
                // For HTML export, we'll create a multi-page document with proper A4 sizing and page breaks
                let htmlContent = `<!DOCTYPE html>
<html>
<head>
  <title>Canvas Export - All Pages</title>
  <style>
    @media print {
      @page {
        size: A4;
        margin: 0;
      }
      .page-break {
        page-break-after: always;
      }
    }
    body {
      margin: 0;
      padding: 0;
      background-color: #f0f0f0;
    }
    .page-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 20px;
    }
    .page {
      width: 794px;
      height: 1123px;
      background-color: white;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
      margin-bottom: 20px;
      overflow: hidden;
    }
    .page:last-child {
      margin-bottom: 0;
    }
    .page-number {
      text-align: center;
      font-family: Arial, sans-serif;
      color: #777;
      margin-bottom: 5px;
    }
  </style>
</head>
<body>
<div class="page-container">`;

                // Save current page index to restore it later
                const currentPageIdx = this.currentPageIndex;
                
                // First add current page
                htmlContent += `
  <div class="page-number">Page ${currentPageIdx + 1} of ${this.pages.length}</div>
  <div class="page">
    ${this.canvas.toSVG()}
  </div>`;
                
                // If there are multiple pages, add each one with a page break
                if (this.pages.length > 1) {
                    // Add all other pages
                    for (let i = 0; i < this.pages.length; i++) {
                        // Skip the current page as it's already added
                        if (i === currentPageIdx) continue;
                        
                        // Load the page temporarily to get its SVG
                        this.canvas.loadFromJSON(this.pages[i], () => {
                            this.canvas.renderAll();
                        });
                        
                        htmlContent += `
  <div class="page-break"></div>
  <div class="page-number">Page ${i + 1} of ${this.pages.length}</div>
  <div class="page">
    ${this.canvas.toSVG()}
  </div>`;
                    }
                    
                    // Restore the current page
                    this.canvas.loadFromJSON(this.pages[currentPageIdx], () => {
                        this.canvas.renderAll();
                    });
                }
                
                // Close the HTML document
                htmlContent += `
</div>
</body>
</html>`;

                data = htmlContent;
                filename = `canvas-export-all-pages.html`;
                mime = 'text/html';
                break;
        }
        
        // Create download link
        const blob = new Blob([data], {type: mime});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        this.closeModal('export-modal');
        this.showNotification('Export successful');
    }
    
    showNotification(message, type = 'success') {
        const notification = document.getElementById('notification');
        const messageElement = document.getElementById('notification-message');
        
        // Set icon based on type
        const iconElement = notification.querySelector('i');
        if (type === 'success') {
            iconElement.className = 'fas fa-check-circle';
            notification.style.backgroundColor = '#4361ee';
        } else if (type === 'warning') {
            iconElement.className = 'fas fa-exclamation-triangle';
            notification.style.backgroundColor = '#f77f00';
        } else if (type === 'error') {
            iconElement.className = 'fas fa-times-circle';
            notification.style.backgroundColor = '#e63946';
        }
        
        // Set message
        messageElement.textContent = message;
        
        // Show notification
        notification.classList.add('show');
        
        // Add pulse animation
        notification.classList.add('pulse');
        setTimeout(() => {
            notification.classList.remove('pulse');
        }, 500);
        
        // Hide after 3 seconds
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }
}

// Initialize the editor when the page is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.editor = new CanvasEditor();
});