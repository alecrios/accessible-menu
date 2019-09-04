class Menu {
    constructor(menu, label, parent) {
        this.parent = parent;
        this.isRoot = !this.parent;
        this.isOpen = this.isRoot;
        this.menu = menu;
        this.label = label;
        this.items = Array.from(Menu.getMenuItems(this.menu)).map((item) => ({ element: item }));
        this.menu.id = this.menu.id || Menu.generateUniqueID();
        this.closeOnOutsideClickBound = this.closeOnOutsideClick.bind(this);
        this.menu.setAttribute('role', this.isRoot ? 'menubar' : 'menu');
        this.menu.setAttribute(...Menu.getMenuAriaLabel(this.menu, this.label));
        this.items.forEach((item, index) => this.processItem(item, index));
    }
    processItem(item, index) {
        const label = Menu.getItemLabel(item);
        const labelID = Menu.generateUniqueID();
        const menu = Menu.getItemMenu(item);
        const menuID = Menu.generateUniqueID();
        label.id = labelID;
        label.tabIndex = Menu.getItemTabIndex(index, this.isRoot);
        label.dataset.index = index;
        label.setAttribute('role', 'menuitem');
        label.addEventListener('keydown', this.keydownHandler.bind(this));
        if (menu) {
            menu.id = menuID;
            item.menu = this.createMenu(menu, label);
        }
    }
    createMenu(menu, label) {
        label.setAttribute('aria-haspopup', true);
        label.setAttribute('aria-controls', menu.id);
        label.setAttribute('aria-expanded', 'false');
        label.addEventListener('click', this.clickHandler.bind(this));
        menu.style.display = 'none';
        return new Menu(menu, label, this);
    }
    clickHandler(event) {
        event.stopPropagation();
        const target = event.target;
        const index = Number(target.dataset.index);
        const menu = this.items[index].menu;
        this.focusItem(index);
        menu.isOpen ? menu.closeMenu() : menu.openMenu();
    }
    openMenu() {
        if (this.isRoot || !this.menu)
            return;
        this.closeSiblingMenus();
        this.label.setAttribute('aria-expanded', 'true');
        this.menu.style.display = 'block';
        this.isOpen = true;
        this.focusFirstItem();
        document.addEventListener('click', this.closeOnOutsideClickBound);
    }
    closeMenu() {
        if (this.isRoot || !this.menu)
            return;
        this.label.focus();
        this.label.setAttribute('aria-expanded', 'false');
        this.menu.style.display = 'none';
        this.isOpen = false;
        document.removeEventListener('click', this.closeOnOutsideClickBound);
        this.closeChildMenus();
    }
    closeSiblingMenus() {
        this.parent.items.forEach((item) => {
            if (item.menu === this || !item.menu || !item.menu.isOpen)
                return;
            item.menu.closeMenu();
        });
    }
    closeChildMenus() {
        this.items.forEach((item) => {
            if (item.menu) {
                item.menu.closeMenu();
            }
        });
    }
    closeParentMenus() {
        if (this.isRoot || this.parent.isRoot)
            return;
        this.parent.closeMenu();
        this.parent.closeParentMenus();
    }
    keydownHandler(event) {
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
        const label = Menu.getItemLabel(this.items[index]);
        if (this.isRoot) {
            this.resetTabIndeces();
            label.tabIndex = 0;
        }
        label.focus();
    }
    resetTabIndeces() {
        this.items.forEach((item) => {
            Menu.getItemLabel(item).tabIndex = -1;
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
            const label = Menu.getItemLabel(this.items[index]);
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
        return item.element.querySelector('.label');
    }
    static getItemMenu(item) {
        return item.element.querySelector('.menu');
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
