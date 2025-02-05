const MIN_INPUTS_NUMBER = 3;
const MAX_LAST_NOTES = 5;
const MAX_BLOCKS_PER_PAGE = 8;
let currentPage = 1;

const DOMFactory = (function() {
    const builderShell = function(element) {
        return {
            get: function() {
                return element;
            },
            addClasses: function(...classes) {
                element.classList.add(...classes);
                return builderShell(element);
            },
            setAttribute: function(name, value) {
                element.setAttribute(name, value);
                return builderShell(element);
            },
            append: function(...nodes) {
                element.append(...nodes);
                return builderShell(element);
            },
            addEventListener: function(eventName, eventF) {
                element.addEventListener(eventName, eventF);
                return builderShell(element);
            }
        };
    }

    return {
        create: function(tagName) {
            return builderShell(document.createElement(tagName));
        }
    };
})();

const LocalStorage = (function(localStorage) {
    return {
        has: function(key) {
            return localStorage.getItem(key) !== null;
        },
        setObject: function(key, obj) {
            localStorage.setItem(key, JSON.stringify(obj))
        },
        getObject: function(key) {
            const item = localStorage.getItem(key);
            return (item !== null) ? JSON.parse(item) : null;
        }
    };
})(window.localStorage);

const PdfInfoStorage = (function(Storage) {
    const KEY = 'PDF_INFO_ARRAY';
    return {
        init: function() {
            if(!Storage.has(KEY)) Storage.setObject(KEY, []);
        },
        getAll: function() {
            return Storage.getObject(KEY);
        },
        getFirstN: function(N) {
            return this.getAll().slice(0, N);
        },
        getNWithOffset: function(N, offset) {
            return this.getAll().slice(offset, offset+N);
        },
        addObj: function(obj) {
            const arr = Storage.getObject(KEY),
                max_id = arr[0] === undefined ? 0 : arr[0].id;
            obj.id = max_id + 1;
            arr.splice(0, 0, obj);
            Storage.setObject(KEY, arr);
        },
        removeById: function(id) {
            let arr = Storage.getObject(KEY),
                index = arr.findIndex(x => x.id === id);
            if(index !== -1) {
                arr.splice(index, 1);
                Storage.setObject(KEY, arr);
            } 
        },
        updateObj: function(obj) {
            const arr = Storage.getObject(KEY),
                index = arr.findIndex(x => x.id===obj.id);
            if(index !== -1) {
                arr[index] = obj;
                Storage.setObject(KEY, arr);
            } 
        },
        length: function() {
            return this.getAll().length;
        }
    };
})(LocalStorage);


function createWarningForDeleting(noAction, yesAction) {
    return DOMFactory.create('div').addClasses('window-menu-container').append(
        DOMFactory.create('div').addClasses('remove-element-warning').append(
            DOMFactory.create('h3').append(document.createTextNode('Do you really want to remove this PDF/Site info?')).get(),
            DOMFactory.create('div').addClasses('buttons-container').append(
                DOMFactory.create('button').addClasses('no').append(document.createTextNode('No')).addEventListener('click', noAction).get(),
                DOMFactory.create('button').addClasses('yes').append(document.createTextNode('Yes')).addEventListener('click', yesAction).get()
            ).get()
        ).get()
    ).get();
}

function getRemoveOnClickAction(id) {
    return () => {
        const noscrollEl = DOMFactory.create('div').addClasses('no-scroll').get();
        const warningEl = createWarningForDeleting(
            () => {
                warningEl.remove();
                noscrollEl.remove();
            },
            () => {
                PdfInfoStorage.removeById(id);
                warningEl.remove();
                noscrollEl.remove();
                loadInfoElements(true);
            }
        );
        document.body.append(warningEl, noscrollEl);
    };
}

function createFormInput(text='') {
    return DOMFactory.create('input').setAttribute('name', 'notes[]').setAttribute('placeholder', 'Note')
    .addEventListener('focusout', focusOutNoteEvent).setAttribute('value', text).get();
}

function getEditNoteClickAction(data) {
    return () => {
        const noteInputsContainer = document.querySelector('.pdf-info-form .notes-fields-container');
        noteInputsContainer.innerHTML = "";
        const form = document.querySelector('.pdf-info-form');
        form.reset();

        const switchBtn = form.querySelector('.switch-page');
        if(switchBtn.textContent === 'notes') switchBtn.dispatchEvent(new Event('click'));

        for(let name of ['title', 'bookName', 'link', 'description'])
            form.querySelector(`[name='${name}']`).value = data[name];

        for(let i = 0; i < data['notes'].length; i++)
            noteInputsContainer.append(createFormInput(data['notes'][i]));
        if(data['notes'].length < MIN_INPUTS_NUMBER) {
            for(let i = data['notes'].length; i < MIN_INPUTS_NUMBER; i++)
                noteInputsContainer.append(createFormInput());
        } else {
            noteInputsContainer.append(createFormInput());
        }

        
        document.body.appendChild(DOMFactory.create('div').addClasses('add-form-now').get());
        const formSubmitBtn = document.querySelector('.pdf-info-form .submit-form-btn');
        formSubmitBtn.onclick = () => {
            const isValid = form.checkValidity();
            if(isValid) {
                const formD = new FormData(form);
                const pdfInfoObj = Object.fromEntries(formD);
                pdfInfoObj.notes = formD.getAll('notes[]').filter(x => x.trim() !== '');
                delete pdfInfoObj['notes[]'];
                pdfInfoObj.id = data.id;
                PdfInfoStorage.updateObj(pdfInfoObj);
                document.querySelector('.add-form-now').remove();
                loadInfoElements(true);
                return false;
            }
            const switchBtn = form.querySelector('.switch-page');
            if(switchBtn.textContent === 'info')
                switchBtn.dispatchEvent(new Event('click'));
            return true;
        };
    };
}

function openLinkAction(link) {
    return () => {
        window.open(link, '_blank').focus();
    };
}

function createPdfInfoElement(data, dark=false) {
    const classes = ['info-container'];
    if(dark) classes.push('dark');
    return DOMFactory.create('div').addClasses(...classes).append(
        DOMFactory.create('span').addClasses('cross').append(document.createTextNode('×')).addEventListener('click', getRemoveOnClickAction(data['id'])).get(),
        DOMFactory.create('span').addClasses('edit').append(document.createTextNode('✎')).addEventListener('click', getEditNoteClickAction(data)).get(),
        DOMFactory.create('h1').addClasses('title').append(document.createTextNode(data['title'])).get(),
        DOMFactory.create('h2').addClasses('book-name').append(document.createTextNode(data['bookName'])).addEventListener('click', openLinkAction(data['link'])).get(),
        DOMFactory.create('div').addClasses('description').append(document.createTextNode(data['description'])).get(),
        DOMFactory.create('div').addClasses('info-about-skipped-notes').append(document.createTextNode(
            data['notes'].length === 0 ? '' : 
            (data['notes'].length > MAX_LAST_NOTES) ? `Last notes (it's ${data['notes'].length-MAX_LAST_NOTES} skipped):` :
            'Last notes:'
        )).get(),
        DOMFactory.create('ul').addClasses('last-notes-container').append(
            ...data['notes'].slice(-MAX_LAST_NOTES).map(x => DOMFactory.create('li').append(document.createTextNode(x)).get())
        ).get()
    ).get();
}

function formAddSubmitAction() {
    const form = document.querySelector('.pdf-info-form');
    const isValid = form.checkValidity();
    if(isValid) {
        const formD = new FormData(form);
        const pdfInfoObj = Object.fromEntries(formD);
        pdfInfoObj.notes = formD.getAll('notes[]').filter(x => x.trim() !== '');
        delete pdfInfoObj['notes[]'];
        PdfInfoStorage.addObj(pdfInfoObj);
        document.querySelector('.add-form-now').remove();
        loadInfoElements(true);
        return false;
    }
    const switchBtn = form.querySelector('.switch-page');
    if(switchBtn.textContent === 'info')
        switchBtn.dispatchEvent(new Event('click'));
    return true;
}

function initButtons() {
    const addNewBtn = document.getElementById('add-new-btn');
    addNewBtn.addEventListener('click', () => {
        const noteInputsContainer = document.querySelector('.pdf-info-form .notes-fields-container');
        noteInputsContainer.innerHTML = "";
        for(let i = 0; i < MIN_INPUTS_NUMBER; i++)
            noteInputsContainer.append(
                DOMFactory.create('input').setAttribute('name', 'notes[]').setAttribute('placeholder', 'Note').addEventListener('focusout', focusOutNoteEvent).get()
            );

        document.querySelector('.pdf-info-form').reset();
        document.body.appendChild(DOMFactory.create('div').addClasses('add-form-now').get());
        const formSubmitBtn = document.querySelector('.pdf-info-form .submit-form-btn');
        formSubmitBtn.onclick = formAddSubmitAction;
    });

    const formCross = document.querySelector('.pdf-info-form .cross');
    formCross.onclick = (e) => {
        document.querySelector('.add-form-now').remove();
        const formInfoContainer = document.querySelector('.pdf-info-form .form-info-container'),
            formNotesContainer = document.querySelector('.pdf-info-form .form-notes-container'),
            switchPageSpan = document.querySelector('.pdf-info-form .switch-page');
        if(formInfoContainer.classList.contains('hide')) {
            formInfoContainer.classList.remove('hide');
            switchPageSpan.innerHTML = 'notes';
        }  
        if(!formNotesContainer.classList.contains('hide'))
            formNotesContainer.classList.add('hide');
    };
  
    const formSwitchBtn = document.querySelector('.pdf-info-form .switch-page');
    formSwitchBtn.onclick = (e) => {
        document.querySelector('.pdf-info-form .form-info-container').classList.toggle('hide');
        document.querySelector('.pdf-info-form .form-notes-container').classList.toggle('hide');
        
        formSwitchBtn.innerHTML = formSwitchBtn.innerHTML === 'notes' ? 'info' : 'notes';
    };
} 

const focusOutNoteEvent = (e) => {
    const value = e.target.value.trim(),
          allNoteInputs = document.querySelectorAll(".pdf-info-form input[name='notes[]']"),
          areAllOtherFilled = Array.from(allNoteInputs).reduce((acc, val) => {
                return !acc ? false : (val === e.target || val.value.trim() !== '');
            }, true);
    const fillTopEmptyByBottomFilled = function(startElement) {
        if(startElement === null || startElement.tagName !== 'INPUT' || startElement.value.trim() === '') return;
        while(startElement.previousElementSibling?.tagName === 'INPUT' && startElement.previousElementSibling.value.trim() === '') {
            startElement.previousElementSibling.value = startElement.value;
            startElement.value = '';
            startElement = startElement.previousElementSibling;
        }
    };

    if(value === '') {
        if(!areAllOtherFilled && allNoteInputs.length > MIN_INPUTS_NUMBER) e.target.remove();
        else fillTopEmptyByBottomFilled(e.target.nextElementSibling);
    } else {
        if(areAllOtherFilled) {
            document.querySelector('.pdf-info-form .notes-fields-container').append(
                DOMFactory.create('input').setAttribute('name', 'notes[]').setAttribute('placeholder', 'Note').addEventListener('focusout', focusOutNoteEvent).get()
            );
        } else {
            fillTopEmptyByBottomFilled(e.target);
        }
    }
};

function initFormNotesLogic() {
    const noteInputs = document.querySelectorAll(".pdf-info-form input[name='notes[]']");
    for(let input of noteInputs) input.addEventListener('focusout', focusOutNoteEvent);
}

function loadInfoElements(clear=false) {
    let infoObjects;
    const filterInput = document.querySelector('nav .search-filter'),
        value = filterInput.value.trim().toLowerCase();
    if(value === '')
        infoObjects = PdfInfoStorage.getAll();
    else 
        infoObjects = PdfInfoStorage.getAll()
                .filter(x => x['title'].toLowerCase().indexOf(value) !== -1 || x['bookName'].toLowerCase().indexOf(value) !== -1);
    const length = infoObjects.length;
    infoObjects = infoObjects.slice((currentPage - 1)*MAX_BLOCKS_PER_PAGE, currentPage*MAX_BLOCKS_PER_PAGE);
    const infoElements = infoObjects.map((obj, i) => createPdfInfoElement(obj, i%2===0));

    if(clear) {
        if(!document.querySelector('.no-content-text').classList.contains('hidden'))
            document.querySelector('.no-content-text').classList.add('hidden');
        const currentElements = document.querySelectorAll('.info-container');
        for(let el of currentElements)
            el.remove();
        document.querySelector('.pagination')?.remove();
    }

    if(infoElements.length !== 0)
        document.body.append(...infoElements, createPaginationElement(currentPage, Math.max(1, Math.ceil(length/MAX_BLOCKS_PER_PAGE))));
    else if(document.querySelector('.no-content-text').classList.contains('hidden'))
        document.querySelector('.no-content-text').classList.remove('hidden');
}

function createPaginationElement(currentNumber, maxNumber) {
    let leftArrowShell = DOMFactory.create('span').addClasses('page-nav-arrow').append(document.createTextNode('⮜')),
        rightArrowShell = DOMFactory.create('span').addClasses('page-nav-arrow').append(document.createTextNode('⮞')); 
    if(currentNumber === 1) leftArrowShell.addClasses('endpoint');
    else leftArrowShell.addEventListener('click', () => {
        currentPage -= 1;
        loadInfoElements(true);
    });
    if(maxNumber <= currentNumber) rightArrowShell.addClasses('endpoint');
    else rightArrowShell.addEventListener('click', () => {
        currentPage += 1;
        loadInfoElements(true);
    });
    return DOMFactory.create('div').addClasses('pagination').append(
        leftArrowShell.get(),
        DOMFactory.create('span').addClasses('page-number-info').append(document.createTextNode(`${currentNumber} / ${maxNumber}`)).get(),
        rightArrowShell.get()
    ).get();
}

function initSearchFilterLogic() {
    document.querySelector('nav .search-filter').addEventListener('input', () => loadInfoElements(true));
}

window.onload = function() {
    PdfInfoStorage.init(); 
    initButtons();
    initFormNotesLogic();
    initSearchFilterLogic();
    loadInfoElements();
}

 