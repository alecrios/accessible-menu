class Menu {
    constructor(menu, label, parent) {
        // Define the class properties.
        this.parent = parent;
        this.isRoot = !this.parent;
        this.isOpen = this.isRoot;
        this.menu = menu;
        this.label = label;
        this.items = Array.from(Menu.getMenuItems(this.menu)).map(this.createItem.bind(this));
        this.closeOnOutsideClickBound = this.closeOnOutsideClick.bind(this);
        // Configure the menu element.
        this.menu.id = this.menu.id || Menu.generateUniqueID();
        this.menu.setAttribute('role', 'menu');
        this.menu.setAttribute(...Menu.getMenuAriaLabel(this.menu, this.label));
    }
    createItem(element, index) {
        // Get references to the item components.
        const label = Menu.getItemLabel(element);
        const menu = Menu.getItemMenu(element);
        // Configure the label element.
        label.tabIndex = Menu.getItemTabIndex(index, this.isRoot);
        label.dataset.index = String(index);
        label.setAttribute('role', 'menuitem');
        label.addEventListener('keydown', this.keydownHandler.bind(this));
        // Return the Item, only creating a new Menu if a menu element was found.
        return { element, label, menu: menu ? this.createMenu(menu, label) : null };
    }
    createMenu(menu, label) {
        // Generate unique IDs for the label and menu.
        const labelID = Menu.generateUniqueID();
        const menuID = Menu.generateUniqueID();
        // Configure the label element.
        label.id = labelID;
        label.setAttribute('aria-haspopup', 'true');
        label.setAttribute('aria-controls', menuID);
        label.setAttribute('aria-expanded', 'false');
        label.addEventListener('click', this.clickHandler.bind(this));
        // Configure the menu element.
        menu.id = menuID;
        menu.style.display = 'none';
        // Return a newly created Menu.
        return new Menu(menu, label, this);
    }
    clickHandler(event) {
        // Prevent propagation of this click event.
        event.stopPropagation();
        // Determine the index and the menu for this item.
        const target = event.target;
        const index = Number(target.dataset.index);
        const menu = this.items[index].menu;
        // Focus the label that was clicked.
        this.focusItem(index);
        // Toggle the visibility state of the menu.
        menu.isOpen ? menu.closeMenu() : menu.openMenu();
    }
    openMenu() {
        // Only continue if there is a menu able to be opened.
        if (this.isRoot || !this.menu || this.isOpen)
            return;
        // Close any open sibling menus.
        this.closeSiblingMenus();
        // Update the label and menu elements.
        this.label.setAttribute('aria-expanded', 'true');
        this.menu.style.display = 'block';
        // Move the focus.
        this.focusFirstItem();
        // Update the menu visibility state.
        this.isOpen = true;
        // Start listening for outside clicks.
        document.addEventListener('click', this.closeOnOutsideClickBound);
    }
    closeMenu() {
        // Only continue if there is a menu able to be closed.
        if (this.isRoot || !this.menu || !this.isOpen)
            return;
        // Close any open child menus.
        this.closeChildMenus();
        // Update the label and menu elements.
        this.label.setAttribute('aria-expanded', 'false');
        this.menu.style.display = 'none';
        // Move the focus.
        this.label.focus();
        // Update the menu visibility state.
        this.isOpen = false;
        // Stop listening for outside clicks.
        document.removeEventListener('click', this.closeOnOutsideClickBound);
    }
    closeSiblingMenus() {
        this.parent.items.forEach((item) => {
            // Only continue if this item is a sibling and has a menu.
            if (item.menu === this || !item.menu)
                return;
            item.menu.closeMenu();
        });
    }
    closeChildMenus() {
        this.items.forEach((item) => {
            // Only continue if this item has a menu.
            if (!item.menu)
                return;
            item.menu.closeMenu();
        });
    }
    closeParentMenus() {
        // Only continue if the parent is able to be closed.
        if (this.isRoot || this.parent.isRoot)
            return;
        this.parent.closeMenu();
        this.parent.closeParentMenus();
    }
    keydownHandler(event) {
        // Determine the key that was pressed and the index of the label it was pressed on.
        const key = event.key;
        const target = event.target;
        const index = Number(target.dataset.index);
        if (key === 'Escape') {
            this.closeMenu();
        }
        else if (key === 'Tab') {
            this.closeMenu();
            this.closeParentMenus();
        }
        else if (key === 'ArrowLeft' || key === 'ArrowUp') {
            this.focusPreviousItem(index);
        }
        else if (key === 'ArrowRight' || key === 'ArrowDown') {
            this.focusNextItem(index);
        }
        else if (key === 'Home' || key === 'PageUp') {
            this.focusFirstItem();
        }
        else if (key === 'End' || key === 'PageDown') {
            this.focusLastItem();
        }
        else if (Menu.isPrintableCharacter(key)) {
            this.focusNextCharacterMatch(index, key);
        }
    }
    closeOnOutsideClick(event) {
        const target = event.target;
        // Only continue if the click target is not a descendent of the menu or label.
        if (target.closest(`#${this.menu.id}`) || target.closest(`#${this.label.id}`))
            return;
        this.closeMenu();
    }
    focusPreviousItem(currentIndex) {
        this.focusItem(currentIndex === 0 ? this.items.length - 1 : currentIndex - 1);
    }
    focusNextItem(currentIndex) {
        this.focusItem(currentIndex === this.items.length - 1 ? 0 : currentIndex + 1);
    }
    focusFirstItem() {
        this.focusItem(0);
    }
    focusLastItem() {
        this.focusItem(this.items.length - 1);
    }
    focusItem(index) {
        const label = this.items[index].label;
        // Employ roving tabindex for the root menu.
        if (this.isRoot) {
            this.resetTabIndeces();
            label.tabIndex = 0;
        }
        label.focus();
    }
    resetTabIndeces() {
        this.items.forEach((item) => {
            item.label.tabIndex = -1;
        });
    }
    focusNextCharacterMatch(currentIndex, character) {
        // Define search bounds.
        const startIndex = currentIndex + 1;
        const endIndex = this.items.length;
        // Search for a match after the current item.
        let matchIndex = this.getNextCharacterMatch(character, startIndex, endIndex);
        // If not found, search for a match before the current item.
        if (matchIndex === -1) {
            matchIndex = this.getNextCharacterMatch(character, 0, currentIndex);
        }
        // If found, focus the item.
        if (matchIndex !== -1) {
            this.focusItem(matchIndex);
        }
    }
    getNextCharacterMatch(character, startIndex, endIndex) {
        // Iterate through the specified range.
        for (let index = startIndex; index < endIndex; index += 1) {
            // Get the first character of this menu item.
            const label = this.items[index].label;
            const firstCharacter = Menu.getFirstCharacter(label);
            // If the first character is a match, return the index.
            if (firstCharacter.toLowerCase() === character.toLowerCase()) {
                return index;
            }
        }
        // No match found.
        return -1;
    }
    static getMenuItems(menu) {
        return menu.querySelectorAll(':scope > .item');
    }
    static getItemLabel(item) {
        return item.querySelector('.label');
    }
    static getItemMenu(item) {
        return item.querySelector('.menu');
    }
    static generateUniqueID() {
        return `menu-${Math.random().toString(36).substr(2, 9)}`;
    }
    static isPrintableCharacter(string) {
        return string.length === 1 && string.match(/\S/) !== null;
    }
    static getFirstCharacter(element) {
        return element.textContent.substring(0, 1);
    }
    static getItemTabIndex(index, isInRootMenu) {
        // Children menu items are only ever focusable programmatically.
        if (!isInRootMenu)
            return -1;
        // Root menu items have a dynamic tabIndex, but initially only the first item is focusable.
        return index === 0 ? 0 : -1;
    }
    static getMenuAriaLabel(menu, label) {
        const ariaLabel = menu.getAttribute('aria-label');
        // If an aria label exists, use it.
        if (ariaLabel) {
            return ['aria-label', ariaLabel];
        }
        // If a label exists, use it to label the menu.
        if (label) {
            return ['aria-labelledby', label.id];
        }
        // Resort to a hardcoded aria label.
        return ['aria-label', 'Menu'];
    }
}
