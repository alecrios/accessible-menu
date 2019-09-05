class Menu {
    constructor(menu, button, parent) {
        // Define the class properties.
        this.menu = menu;
        this.button = button;
        this.parent = parent;
        this.isRoot = !this.parent;
        this.isToggleable = !!this.button;
        this.hasExternalButton = this.isRoot && this.isToggleable;
        this.isOpen = !this.isToggleable;
        this.items = Array.from(Menu.getMenuItems(this.menu)).map(this.createItem.bind(this));
        this.closeOnOutsideClickBound = this.closeOnOutsideClick.bind(this);
        // Configure elements.
        this.setMenuAndButtonID();
        this.setMenuRole();
        this.setMenuAriaLabel();
        this.configureButton();
    }
    setMenuAndButtonID() {
        // Prefer to keep the existing ID, but fallback to a random string if necessary.
        this.menu.id = this.menu.id || Menu.generateUniqueID();
        if (!this.hasExternalButton)
            return;
        // Prefer to keep the existing ID, but fallback to a random string if necessary.
        this.button.id = this.button.id || Menu.generateUniqueID();
    }
    setMenuRole() {
        // If the menu is toggleable, `menu`. If it's visually persistent, `menubar`.
        this.menu.setAttribute('role', this.isToggleable ? 'menu' : 'menubar');
    }
    setMenuAriaLabel() {
        // Always prefer to reference the button, if it exists.
        if (this.button) {
            this.menu.setAttribute('aria-labelledby', this.button.id);
            return;
        }
        // If there is no button, but there is an aria label, do not change it.
        if (this.menu.getAttribute('aria-label'))
            return;
        // If there is no button or aria label, resort to a hardcoded aria label.
        this.menu.setAttribute('aria-label', 'Menu');
    }
    configureButton() {
        if (!this.hasExternalButton)
            return;
        this.button.setAttribute('aria-haspopup', 'true');
        this.button.setAttribute('aria-expanded', 'false');
        this.button.setAttribute('aria-controls', this.menu.id);
        this.button.addEventListener('click', this.menuButtonClickHandler.bind(this));
    }
    createItem(element, index) {
        // Get references to the item components.
        const button = Menu.getItemButton(element);
        const menu = Menu.getItemMenu(element);
        // Configure the button element.
        button.tabIndex = Menu.getItemTabIndex(index, this.isRoot);
        button.dataset.index = String(index);
        button.setAttribute('role', 'menuitem');
        button.addEventListener('keydown', this.keydownHandler.bind(this));
        // Return the Item, only creating a new Menu if a menu element was found.
        return { element, button, menu: menu ? this.createMenu(menu, button) : null };
    }
    createMenu(menu, button) {
        // Generate unique IDs for the menu and button.
        const buttonID = Menu.generateUniqueID();
        const menuID = Menu.generateUniqueID();
        // Configure the button element.
        button.id = buttonID;
        button.setAttribute('aria-haspopup', 'true');
        button.setAttribute('aria-controls', menuID);
        button.setAttribute('aria-expanded', 'false');
        button.addEventListener('click', this.buttonClickHandler.bind(this));
        // Configure the menu element.
        menu.id = menuID;
        menu.style.display = 'none';
        // Return a newly created Menu.
        return new Menu(menu, button, this);
    }
    menuButtonClickHandler() {
        // Toggle the visibility state of the menu.
        this.isOpen ? this.closeMenu() : this.openMenu();
    }
    buttonClickHandler(event) {
        // Prevent propagation of this click event.
        event.stopPropagation();
        // Determine the index and the menu for this item.
        const target = event.target;
        const index = Number(target.dataset.index);
        const menu = this.items[index].menu;
        // Focus the button that was clicked.
        this.focusItem(index);
        // Toggle the visibility state of the menu.
        menu.isOpen ? menu.closeMenu() : menu.openMenu();
    }
    openMenu() {
        // Only continue if there is a menu able to be opened.
        if (!this.menu || !this.isToggleable || this.isOpen)
            return;
        // Close any open sibling menus.
        this.closeSiblingMenus();
        // Update the button and menu elements.
        this.button.setAttribute('aria-expanded', 'true');
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
        if (!this.menu || !this.isToggleable || !this.isOpen)
            return;
        // Close any open child menus.
        this.closeChildMenus();
        // Update the button and menu elements.
        this.button.setAttribute('aria-expanded', 'false');
        this.menu.style.display = 'none';
        // Move the focus.
        this.button.focus();
        // Update the menu visibility state.
        this.isOpen = false;
        // Stop listening for outside clicks.
        document.removeEventListener('click', this.closeOnOutsideClickBound);
    }
    closeSiblingMenus() {
        if (!this.parent)
            return;
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
        if (this.isRoot)
            return;
        if (this.parent.isRoot && !this.parent.hasExternalButton)
            return;
        this.parent.closeMenu();
        this.parent.closeParentMenus();
    }
    keydownHandler(event) {
        // Determine the key that was pressed and the index of the button it was pressed on.
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
        // Only continue if the click target is not a descendent of the menu or button.
        if (target.closest(`#${this.menu.id}`) || target.closest(`#${this.button.id}`))
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
        const button = this.items[index].button;
        // Employ roving tabindex for the root menu.
        if (this.isRoot) {
            this.resetTabIndeces();
            button.tabIndex = 0;
        }
        button.focus();
    }
    resetTabIndeces() {
        this.items.forEach((item) => {
            item.button.tabIndex = -1;
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
            const button = this.items[index].button;
            const firstCharacter = Menu.getFirstCharacter(button);
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
    static getItemButton(item) {
        return item.querySelector('.button');
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
}
