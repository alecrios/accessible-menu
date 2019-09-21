/** A class which manages the behavior of a navigational menu system. */
class Menu {
    constructor(menu, button, options, parent) {
        // Define the class properties.
        this.menu = menu;
        this.button = button;
        this.options = options;
        this.parent = parent;
        this.isRoot = !this.parent;
        this.depth = this.isRoot ? 0 : this.parent.depth + 1;
        this.isToggleable = !!this.button;
        this.hasMenuButton = this.isRoot && !!this.button;
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
        // Only continue if this menu is toggleable via a menu button.
        if (!this.hasMenuButton)
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
        // Only continue if a menu button exists.
        if (!this.hasMenuButton)
            return;
        // Set the aria label if no discernible text is found.
        if (!this.button.innerText && !this.button.getAttribute('aria-label')) {
            this.button.setAttribute('aria-label', 'Menu Button');
        }
        // Configure the rest of the button's attributes and behavior.
        this.button.setAttribute('role', 'button');
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
        // Return the Item, only creating a new Menu if a menu element is found.
        return menu !== null
            ? { element, button, menu: this.createMenu(menu, button) }
            : { element, button };
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
        return new Menu(menu, button, this.options, this);
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
        // Update the menu visibility state.
        this.isOpen = true;
        // Update the button element.
        this.button.setAttribute('aria-expanded', 'true');
        // Start listening for outside clicks.
        document.addEventListener('click', this.closeOnOutsideClickBound);
        // Run the transition animation.
        const transition = this.getTransition('open');
        transition(this.menu, () => {
            this.focusFirstItem();
            this.closeSiblingMenus();
        });
    }
    closeMenu(instant = false) {
        // Only continue if there is a menu able to be closed.
        if (!this.menu || !this.isToggleable || !this.isOpen)
            return;
        // Update the menu visibility state.
        this.isOpen = false;
        // Update the button element.
        this.button.setAttribute('aria-expanded', 'false');
        // Stop listening for outside clicks.
        document.removeEventListener('click', this.closeOnOutsideClickBound);
        // Run the transition animation.
        const transition = instant ? Menu.transitions.instant.close : this.getTransition('close');
        transition(this.menu, () => {
            this.button.focus();
            this.closeChildMenus();
        });
    }
    // TODO: Clean up this function.
    getTransition(type) {
        // Check for a provided transition function.
        if (this.options
            && this.options.transitions
            && this.options.transitions[this.depth]
            && this.options.transitions[this.depth][type]) {
            return this.options.transitions[this.depth][type];
        }
        // Check if an ancester menu's transition settings apply to children.
        if (!this.isRoot) {
            for (let index = this.depth - 1; index >= 0; index -= 1) {
                if (this.options
                    && this.options.transitions
                    && this.options.transitions[index]
                    && this.options.transitions[index].applyToChildren) {
                    return this.options.transitions[index][type];
                }
            }
        }
        // Default to the instant transition function.
        return Menu.transitions.instant[type];
    }
    closeSiblingMenus() {
        if (!this.parent)
            return;
        this.parent.items.forEach((item) => {
            // Only continue if this item is a sibling and has a menu.
            if (item.menu === this || !item.menu)
                return;
            // Close the menu.
            item.menu.closeMenu();
        });
    }
    closeChildMenus() {
        this.items.forEach((item) => {
            // Only continue if this item has a menu.
            if (!item.menu)
                return;
            // Close the the menu instantly, because its parent is already closed.
            item.menu.closeMenu(true);
        });
    }
    closeParentMenus() {
        // Only continue if there is a parent menu to close.
        if (!this.parent)
            return;
        // Don't close the parent menu if it is the root menu, unless it has a menu button.
        if (this.parent.isRoot && !this.parent.hasMenuButton)
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
        // Employ roving tab index for the root menu.
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
        return `m${Math.random().toString(36).substr(2, 9)}`;
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
        // Root menu items have a dynamic tab index, but initially only the first item is focusable.
        return index === 0 ? 0 : -1;
    }
}
/** The publicly available transition functions for opening and closing menus. */
Menu.transitions = {
    instant: {
        open(menu, callback) {
            menu.style.display = 'block';
            callback();
        },
        close(menu, callback) {
            menu.style.display = 'none';
            callback();
        },
    },
    opacity: {
        open(menu, callback) {
            menu.style.opacity = '0';
            menu.style.transition = 'opacity 125ms ease';
            menu.style.display = 'block';
            menu.addEventListener('transitionend', () => {
                callback();
            }, { once: true });
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    menu.style.opacity = '1';
                });
            });
            callback();
        },
        close(menu, callback) {
            menu.style.opacity = '1';
            menu.style.transition = 'opacity 125ms ease';
            menu.addEventListener('transitionend', () => {
                menu.style.display = 'none';
                callback();
            }, { once: true });
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    menu.style.opacity = '0';
                });
            });
        },
    },
    height: {
        open(menu, callback) {
            menu.style.overflow = 'hidden';
            menu.style.display = 'flex';
            const height = menu.offsetHeight;
            menu.style.height = '0';
            menu.style.transition = 'height 125ms ease-out';
            menu.addEventListener('transitionend', () => {
                menu.style.overflow = 'visible';
                menu.style.transition = 'none';
                menu.style.height = 'auto';
                callback();
            }, { once: true });
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    menu.style.height = `${height}px`;
                });
            });
        },
        close(menu, callback) {
            menu.style.overflow = 'hidden';
            menu.style.display = 'flex';
            const height = menu.offsetHeight;
            menu.style.height = `${height}px`;
            menu.style.transition = 'height 125ms ease-out';
            menu.addEventListener('transitionend', () => {
                menu.style.display = 'none';
                menu.style.overflow = 'visible';
                menu.style.transition = 'none';
                menu.style.height = 'auto';
                callback();
            }, { once: true });
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    menu.style.height = '0';
                });
            });
        },
    },
};
