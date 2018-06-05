import '@polymer/polymer/polymer-element.js';
import '@polymer/polymer/lib/utils/flattened-nodes-observer.js';
import '@bower_components/air-cascade-validator/air-nodes-visitor-utils.js';

import { isEqual } from 'lodash-es/lodash.js';

//import 'ether-lodash/ether-lodash-core.js';
/**
 * FiveElements Namespace definition
 */
window.FiveElements = window.FiveElements || {};

/**
 * Air Cruddy Mixin implement the all logic for man,aging the CRUD request/response.
 * To use with your custom server format, you could extends @see air-cruddy-adapter-elasticsearch-mixin.html
 * @polymerMixin
 */
FiveElements.AirCruddyMixin = superclass => class extends superclass {

    static get properties() {
        return {
            /**
             * Auto Save
             */
            debug: {
                type: Boolean,
                value: false
            },
            /**
             * Auto Save
             */
            autoSave: {
                type: Boolean,
                value: false
            },
            reloadOnCreate: {
                type: Boolean,
                value: false
            },
            /**
             * Url endpoint of the Rest Web-Service
             *
             */
            url: {
                type: String
            },
            /**
             * Entity Id of the resource to CRUD
             */
            entityId: {
                type: String,
                notify: true
            },
            /**
             * Entity Id for change the component in 'create' mode
             */
            entityIdForNew: {
                type: String,
                value: 'new'
            },
            /**
             * The data load from the URL endpoint of the Rest Web-Service
             */
            data: {
                type: Object,
                notify: true
            },
            /**
             * A backup of the Data Load
             */
            _dataOrigin: {
                type: Object,
                readonly: true
            },
            /**
             * A backup of the Data Load
             */
            _dataDirty: {
                type: Object,
                readonly: true
            },
            /**
             * The current edition mode.
             * 'create', 'update', 'unset'
             */
            _cruddyMode: {
                type: String,
                notify: true,
                readonly: true
            },
            isDirty: {
                type: Boolean,
                notify: true,
                readonly: true,
                value: false
            },
            isValid: {
                type: Boolean,
                notify: true,
                readonly: true,
                value: true
            },
            status: {
                type: Object,
                notify: true,
                readonly: true,
                value: function () {
                    return {
                        isDirty: false,
                        mode: 'unset'
                    }
                }
            },
            lastResponse: {
                type: Object,
                notify: true,
                readonly: true
            },
            /**
             * Fetch Configuration :
             *
             * The mode you want to use for the request, e.g., cors, no-cors, same-origin, or navigate.
             */
            mode: {
                type: String,
                value: 'cors'
            },

            /**
             * Fetch Configuration :
             *
             * The cache mode you want to use for the request.
             */
            cache: {
                type: String,
                value: 'default'
            },

            /**
             * Fetch Configuration :
             *
             * The redirect mode to use: follow, error, or manual. In Chrome the default is follow
             */
            redirect: {
                type: String,
                value: 'follow'
            },
            /**
             * Fetch Configuration :
             *
             * A USVString specifying no-referrer, client, or a URL. The default is client.
             */
            referrer: {
                type: String,
                value: 'client'
            },
            /**
             *  Fetch Configuration :
             *
             *  integrity: Contains the subresource integrity value of the request (e.g., sha256-BpfBw7ivV8q2jLiT13fxDYAe2tJllusRSZ273h2nFSE=). (https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity)
             */
            integrity: {
                type: String
            },
            /**
             *  Fetch Configuration :
             *
             * credentials: The request credentials you want to use for the request: omit, same-origin, or include. The default is omit.
             * In Chrome the default is same-origin before Chrome 47
             * and include starting with Chrome 47.
             */
            credentials: {
                type: String,
                value: 'omit'
            },
            /**
             * Remote Command like : 'save', 'delete", 'newEntity'
             */
            command: {
                type: String,
                notify: true,
                observer: '_commandChanged'
            }
        };
    }

    static get observers() {
        return [
            '_dataChangeObserver(data.*)',
            '_entityIdChangeObserver(entityId)',
            '_isDirtyModeObserver(isValid, isDirty, _cruddyMode)'

        ];
    }

    // --- Life Cycle
    // --- ---------------------------

    constructor() {
        super();
        this._boundListenerFocusOut = this._handleFocusOut.bind(this);
    }

    connectedCallback() {
        super.connectedCallback();
        this.addEventListener('focusout', this._boundListenerFocusOut);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this.removeEventListener('focusout', this._boundListenerFocusOut);
    }

    // --- Logs
    // --- ---------------------------

    logDebug() {
        if (this.debug) {
            console.log(...arguments);
        }
    }

    // --- Marking interface
    // --- ---------------------------
    /**
     * Making method in order to find the AirCruddy implementations
     */
    airCruddyElements() {
        return {
            validate: this.validate.bind(this),
            save: this.save.bind(this),
            delete: this.delete.bind(this),
            newEntity: this.newEntity.bind(this),
            reset: this.reset.bind(this)

        };
    }


    // --- Listener
    // --- ---------------------------
    _handleFocusOut(e) {
        this.logDebug('- - - - - -> focusout :  isDirty(', this.isDirty, ') ', e);
        if (this.autoSave && this.isDirty) {
            this.logDebug('request auto-save');
            this.save();
        } else if (this.autoSave && !this.isDirty && !this.isValid) {
            this.validate();
        }
    };

    // --- Changed Observer
    // --- ---------------------------
    _commandChanged(newCommand) {
        if (!newCommand) return;
        let cmdFunc = this[newCommand];
        this.logDebug('command : ', newCommand);
        if (typeof cmdFunc === 'function') {
            let action = cmdFunc.bind(this);
            let self = this;
            // call any command
            return action().then(function (result) {
                self.command = undefined;
                return result;
            }).catch(function (error) {
                self.command = undefined;
                return error;
            });
        }
    };

    _entityIdChangeObserver(entityId) {
        if (entityId && (entityId !== this.entityIdForNew)) {
            if ((!this.data) || (this.data.id !== entityId )) {
                this.logDebug('---- set entityId Observer :', entityId);
                this.retrieve(entityId);
            }
        } else if ((entityId === null) || (entityId === this.entityIdForNew)) {
            if ((this._cruddyMode === 'create') && (  Object.keys(this._dataDirty).length === 0)) {
                return false;
            }
            this.logDebug('---- set entityId Observer : null ==> newEntity');
            return this.newEntity();
        } else {
            this.logDebug('---- set entityId Observer : undefined ==> clean');
            return this.clean();
        }
    };

    // --- Dirty Changed
    // --- ---------------------
    _dataChangeObserver(changeRecord) {
        // https://github.com/FiveElements/air-cruddy/blob/iron-ajax/air-cruddy-dirty-behaviour.html
        this.logDebug('... ', changeRecord.path + ' changed to ', changeRecord.value, ' // ', changeRecord);
        if (!this._dataDirty) {
            return;
        }
        // Compare the Change to Origin loaded data
        // -----------------------------------------
        // Extract the object prefix : 'data.'.length = 5
        let pathChanged = changeRecord.path.slice(5);
        let isValueEqual = true;
        switch (pathChanged) {
            case '':
            case 'id':
            case 'version':
                isValueEqual = true;
                break;
            default:
                let valueOri = this.get(pathChanged, this._dataOrigin);
                isValueEqual = this._isValueEqual(valueOri, changeRecord.value);
        }
        // Manage Change Field List
        // -------------------------
        let isDirty = undefined;
        let dataDirty = this._dataDirty;
        if (isValueEqual) {
            delete dataDirty[pathChanged];
            isDirty = Object.keys(dataDirty).length > 0;
        } else {
            dataDirty[pathChanged] = true;
            isDirty = true;
        }
        this._dataDirty = dataDirty;
        this.isDirty = isDirty;
    };

    _isDirtyModeObserver(isValid, isDirty, cruddyMode) {
//            let crudStatus = this.status;
//            let notifyChange = false;
//            if (crudStatus.isDirty !== isDirty) {
//                crudStatus.isDirty = isDirty;
//                notifyChange = true;
//            }
//            if (crudStatus.mode !== cruddyMode) {
//                crudStatus.mode = cruddyMode;
//                notifyChange = true;
//            }
        // Status
        let crudStatus = {
            isValid: isValid,
            isDirty: isDirty,
            mode: cruddyMode
        };
//            if (notifyChange)
        this.status = crudStatus;
        this._fireStatusChanged(crudStatus);
//            this.logDebug('status : ', crudStatus);
    };

    _isValueEqual(dataRef, data) {
        return isEqual(dataRef, data);
    };

    // --- mock
    // --- ---------------------------

    retrieveById(entityId) {
        this.logDebug("Request Retrieve: ", entityId);
        return this._fetchPromiseRetrieve(entityId).catch(function (error) {
            this.logDebug('post error', error);
        });
    };


    // --- API
    // --- ---------------------------
    /**
     * Send Retrieve request to the Rest Web Service Server
     * @param entityId The entityId to load or if not defined the entityId deine in the 'air-cruddy' Web-Componnent
     * @return {Promise}
     */
    retrieve(entityId) {
//                let loadId = entityId || this.entityId;
        let loadId = this.entityId;
        return this._fetchPromiseRetrieve(loadId);
    };

    /**
     * Send Update request to Server.
     * @return {Promise}
     */
    update() {
        let entityId = this.data.id || this.entityId;
        return this._fetchPromiseUpdate(entityId, this.data);
    };

    /**
     * Send Delete request to Server.
     * @return {Promise}
     */
    delete() {
        let entityId = this.data.id || this.entityId;
        return this._fetchPromiseDelete(entityId, this.data);
    };

    /**
     * Send Save request (create or update) to the Server
     * @return {Promise}
     */
    save() {
        if (!this.isDirty) {
            this.logDebug('Not Save, Data is NOT Dirty');
            return new Promise((resolve, reject) => {
                resolve(false);
            });
        }
        return this.validatePromise().then((isValid) => {
            if (!isValid) {
                this.logDebug('Not Save, Data Not valid');
                return false;
            }
            this.logDebug('call save', this._cruddyMode);
            if (this._cruddyMode === 'create') {
                return this.create();
            } else {
                return this.update();
            }
        });
    };

    /**
     * Send Create request to Server.
     * @return {Promise}
     */
    create() {
        return this._fetchPromiseCreate(null, this.data);
    };


    /**
     * Restore the data from with the last request retrieve.
     * @return {Promise}
     */
    reset() {
        return new Promise((resolve, reject) => {
            const state = this.snapshotState();
            this.lastResponse = undefined;
            let cloned = this.cloneObject(this._dataOrigin);
            this._setCrudDataModeUpdate(cloned);
            resolve(state);
        });
    };

    // --- Init Status
    // --- ---------------------------
    /**
     * Clean all component State, like data loaded or entityId definition.
     * TO have the save init State
     * @return {Promise}
     */
    clean() {
        return new Promise((resolve, reject) => {
            this.lastResponse = undefined;
            this.entityId = undefined;
            this._setCrudDataModeUnset(undefined);
            resolve(true);
        });
    };

    /**
     * Create new empty entity in order to be saved
     * @return {Promise}
     */
    newEntity() {
        return new Promise((resolve, reject) => {
            this.lastResponse = undefined;
            let data = this._createEmptyEntityModel();
            this._setCrudDataModeCreate(data);
            if ((this.entityId !=null) ||( this.entityId !== this.entityIdForNew)) {
                this.entityId = this.entityIdForNew;
            }
            resolve(data);
        });

    };


    /**
     *  Set Data with Clone When data is retrieve
     */
    _setCrudDataModeCreate(data) {
        this.logDebug('~~~~~~~~ Create Mode ~~~~~~~~ ');
        this._cruddyMode = 'create';
        this._dataDirty = {};
        this._dataOrigin = this.cloneFreezeObject(data);
        this.data = data;
        this.isDirty = false;
//            this.entityId = null;
    };

    _setCrudDataModeUpdate(data) {
        this.logDebug('~~~~~~~~ Update Mode ~~~~~~~~ ');
        this._cruddyMode = 'update';
        this._dataDirty = {};
        this._dataOrigin = this.cloneFreezeObject(data);
        this.data = data;
        this.isDirty = false;
//            if (this.entityId !== data.id) {
//                this.entityId = data.id;
//            }
    };

    _setCrudDataModeUnset() {
        this.logDebug('~~~~~~~~ Unset Mode ~~~~~~~~ ');
        this._cruddyMode = 'unset';
        this._dataDirty = undefined;
        this._dataOrigin = undefined;
        this.data = undefined;
        this.isDirty = false;
//            this.entityId = undefined;
    };

    // ---Snapshot & Restore States
    // --- ---------------------------
    snapshotState() {
        const state = {
            entityId: this.entityId,
            data: this.data,
            dataOrigin: this._dataOrigin,
            dataDirty: this._dataDirty,
            lastResponse: this.lastResponse,
            cruddyMode: this._cruddyMode,
            isDirty: this.isDirty,
            isValid: this.isValid
        };
        return state;
    }

    restoreState(state) {
        if (state) {
            this.data = this.cloneObject(state.data);
            this._dataOrigin = this.cloneObject(state.dataOrigin);
            this._dataDirty = this.cloneObject(state.dataDirty);
            this.lastResponse = this.cloneObject(state.lastResponse);
            this._cruddyMode = state.cruddyMode;
            this.isDirty =  state.isDirty;
            this.isValid =  state.isValid;
        }
        return state;
    }


    // ---Create API
    // --- ---------------------------

    _createEmptyEntityModel() {
        const formModel = this._callFormElements('createEmptyEntityModel');
        const model = formModel || {};
        this.logDebug('_createEmptyEntityModel', model);
        return model;
    };


    _callFormElements(funcName) {
        const crudContentNode = this.$.crudContent;
        const formNodes = this._computeFilterNodes(crudContentNode, (node) => {
            if (node[funcName]) {
                return true;
            }
        }, false);
        if (formNodes && formNodes.length > 1) {
            console.warn('Many _callFormElements with function ', funcName);
        }
        if (formNodes && formNodes.length > 0) {
            let formFunc = formNodes[0][funcName].bind(formNodes[0]);
            return formFunc();
        }
        return null;
    }


    // --- Status
    // --- ---------------------------

//        computeStatus(data, dataOrigin) {
//            if ((data === null) || (data === undefined)) {
//                return 'unsetMode';
//            } else {
//                if (dataOrigin === null) {
//                    return 'createMode';
//                } else {
//                    return 'updateMode';
//                }
//            }
//        };

    // --- Validation
    // --- ---------------------------


    validate(callback) {
//            let distributed = this.getContentChildren('#crudContent');
        let validateNodes = this._getValidateNodes();
        let isValid = this.validateNodes(validateNodes,callback);
        // Change State
        this.isValid = isValid;
        return isValid;
    };

    validateNodes(validateNodes, callback) {
        if (!validateNodes || (Object.keys(validateNodes).length < 1)) {
            this.logDebug('No validateNodes : ==> true ');
            return true;
        }
        this.logDebug('Test validateNodes :   ', validateNodes);
        return validateNodes.reduce((acc, node) => {
            let validateFunc = node['validate'].bind(node);
            let isValidNode = validateFunc(callback);
//                if (this.debug)  this.logDebug('Test to validate a Node :   ', node, '==>',  isValidNode);
            return isValidNode && acc;
        }, true);
    };

    /**
     *
     * @return {Promise}
     */
    validatePromise() {
        return new Promise((resolve, reject) => {
            let valid = this.validate();
            resolve(valid);
        }).catch(err => console.error(err));
    };

    _getValidateNodes() {
        if (this.$.validator) {
            return [this.$.validator];
        }
        // Look in shadow Dom
        return this._computeFilterNodes(this, (node) => {
            if (node.validate) {
                return true;
            }
            return false;
        }, false)
    };


    // --- Fetch Configuration
    // --- ---------------------------

    _defaultHearders() {
        let myHeaders = new Headers({
            'Content-Type': 'application/json' // "text/plain"
        });
        return myHeaders;
    };

    /**
     * Compute default Fetch option
     * @param method
     * @param data
     * @returns {{method: *, mode: *, headers: *}}
     * @private
     */
    _defaultOptions(method, data) {
        let myHeaders = this._defaultHearders();
        // https://developer.mozilla.org/en-US/docs/Web/API/Request/Request
        let init = {
            method: method,
            mode: this.mode,
            cache: this.cache,
            redirect: this.redirect,
            referrer: this.referrer,
            credentials: this.credentials,
            headers: myHeaders
        };
        if (this.integrity) {
            init.integrity = this.integrity;
        }
        return init;
    };


    _fetchUrlEntityId(entityId, version) {
        let url = this.url + '/' + entityId;
        if (version) {
            url += '?version=' + version;
        }
        return url;
    };

    _fetchUrlRoot() {
        return this.url;
    };


    // --- Elasticsearch API Transformer
    // --- ---------------------------
    _dataSerializerEntity(data) {
        return JSON.stringify(data);
    };

    /**
     * Adapt response from Retrieve Web-Service o the expected format
     * ```
     * {
         *   id: '',
         *   version: '',
         *   ...
         * }
     * ```
     */
    _adapterResponseRetrieve(res) {
        return res;
    };


    /**
     * Adapt response from Update Web-Service o the expected format
     * ```
     * { status: 200,
     *   statusText: 'OK',
     *   response: {
     *        id: '',
     *        version: '',
     *   ...
     *   }
     * }
     * ```
     */
    _adapterResponseUpdate(res) {
        return res;
    };


    /**
     * Adapt response from Create Web-Service o the expected format
     * ```
     * { status: 200,
     *   statusText: 'OK',
     *   response: {
     *        id: 'The New entity Id',
     *        version: 'The New version',
     *   ...
     *   }
     * }
     * ```
     */
    _adapterResponseCreate(res) {
        return res;
    };


    /**
     * Adapt response from Delete Web-Service o the expected format
     * ```
     * { status: 200,
     *   statusText: 'OK',
     *   response: {
     *        id: 'The New entity Id',
     *        version: 'The New version',
     *   ...
     *   }
     * }
     * ```
     */
    _adapterResponseDelete(res) {
        return res;
    };

    /**
     * Adapt data model For Update or Create request
     *
     * @param opt Fetch configuration in format ``` { url:'', init:{}, data:{}}```
     */
    _adapterFetchInitData(opt) {
        return opt;
    };

    /**
     * Adapt data model For Update request
     *
     * @param opt Fetch configuration in format ``` { url:'', init:{}, data:{}}```
     */
    _adapterFetchInitDataUpdate(opt) {
        return this._adapterFetchInitData(opt);
    };

    /**
     * Adapt data model For Create request
     *
     * @param opt Fetch configuration in format ``` { url:'', init:{}, data:{}}```
     */
    _adapterFetchInitDataCreate(opt) {
        return this._adapterFetchInitData(opt);
    };


    // --- Elasticsearch API
    // --- -------------------------------
    _fetchUrlRetrieve(entityId, version) {
        return this._fetchUrlEntityId(entityId, version);
    };

    _fetchUrlUpdate(entityId, version) {
        return this._fetchUrlEntityId(entityId, version);
    };

    _fetchUrlDelete(entityId, version) {
        return this._fetchUrlEntityId(entityId, version);
    };

    _fetchUrlCreate(entityId, version) {
        return this._fetchUrlRoot();
    };

    // --- Fetch Request
    // --- -------------------------------

    /**
     * Fetch configuration for Retrieve request in format
     * ```js
     * {
     *   url: 'String',
     *   init: {},
     *   data: {}
     * }
     * ```
     * @return {Promise}
     */
    _fetchInitRetrieve(entityId, data) {
        return new Promise((resolve, reject) => {
            let version = data ? data.version : null;
            const url = this._fetchUrlRetrieve(entityId, version);
            const init = this._defaultOptions('GET');
            const info = this._defaultTracing('retrieve');
            resolve({init, url, info});
        });
    };


    /**
     * Fetch configuration for Update request in format
     * ```js
     * {
     *   url: 'String',
     *   init: {},
     *   data: {}
     * }
     * ```
     * @return {Promise}
     */
    _fetchInitUpdate(entityId, data) {
        return new Promise((resolve, reject) => {
            const version = data ? data.version : null;
            const url = this._fetchUrlUpdate(entityId, version);
            const init = this._defaultOptions('PUT', data);
            const info = this._defaultTracing('update');
            resolve({init, url, data, info});
        });
    };

    /**
     * Fetch configuration for Delete request in format
     * ```js
     * {
     *   url: 'String',
     *   init: {},
     *   data: {}
     * }
     * ```
     * @return {Promise}
     */
    _fetchInitDelete(entityId, data) {
        return new Promise((resolve, reject) => {
            const version = data ? data.version : null;
            const url = this._fetchUrlDelete(entityId, version);
            const init = this._defaultOptions('DELETE', data);
            const info = this._defaultTracing('delete');
            resolve({init, url, data, info});
        });
    };

    /**
     * Fetch configuration for Create request in format
     * ```js
     * {
     *   url: 'String',
     *   init: {}
     *   data: {}
     * }
     * ```
     * @return {Promise}
     */
    _fetchInitCreate(entityId, data) {
        return new Promise((resolve, reject) => {
            const url = this._fetchUrlCreate(entityId, data);
            const init = this._defaultOptions('POST', data);
            const info = this._defaultTracing('create');
            resolve({init, url, data, info});
        });
    };

    _defaultTracing(requestType) {
        const now = new Date().getTime();
        const processingBegin = performance ? performance.now() : now;
        const info = {
            requestId: this.uuidv4(),
            requestType,
            processing: true,
            beginDate: now,
            processingBegin
        };
        return info;
    }

    _handleTracingEnd(response) {
        const info = this.cloneObject(response.info) || {};
        if (info) {
            // Now
            const now = new Date().getTime();
            let processingEnd = performance ? performance.now() : now;
            //clone
            info.processing = false;
            info.endDate = now;
            if (info.beginDate) {
                const processingMs = processingEnd - info.processingBegin;
                info.processingMs = processingMs;
            }
        }
        response.info = info;
        return response;
    }

    _handleTracingError(error) {
        this._handleTracingEnd(error);
        const info = error.info;
        info.error = {
            message: error.message,
            status: error.status,
            statusText: error.statusText,
            responseText: error.responseText
        };
        return error;
    }

    // --- Component linker
    // --- ---------------------------
//        _extractResponseHeaders(response) {
//            let myHeaders = response.headers;
//            let headers = {};
//            for (let pair of myHeaders.entries()) {
//                headers[pair[0]] = pair[1];
//            }
//            return headers;
//        };

    _isResponseJson(response) {
        const contentType = response.headers.get('content-type');
        return (contentType && contentType.indexOf('application/json') !== -1)
    };


    // --- Fetch Helper
    // --- ---------------------------

    /**
     * Fetch the request
     * @param opt The fetch option {url, init}
     * @return {Promise}
     */
    _fetchRequest(opt) {
        this.logDebug('____________ Fetch opt', opt.init.method, ' ____________', opt);
        return window.fetch(opt.url, opt.init).then(response => {
            response.info = opt.info;
            this.logDebug('---  _fetchRequest', response);
            return response;
        });
    };

    _checkResponseStatus(response) {
        if (!response.ok) {
            const error = new Error(response.status + ' (' + response.statusText + ')');
            error.status = response.status;
            error.statusText = response.statusText;
            // Manage
            if (this._isResponseJson(response)) {
                return response.json().then(function (json) {
                    error.responseJson = json;
                    error.responseText = JSON.stringify(json);
                    return Promise.reject(error);
                });
            } else {
                return response.text().then(function (text) {
                    error.responseText = text;
                    return Promise.reject(error);
                });
            }


        }
        return response;
    };

    _transformResponseJson(response) {
        let res = {
            status: response.status,
            statusText: response.statusText,
            url: response.url,
            type: response.type,
            headers: response.headers,
            info: response.info
        };
//            this.logDebug('_transformResponseJson res :', res);
//            for (var p of response.headers) {
//                this.logDebug(p); // returns a Headers{} object
//            }
        return response.json().then(responseJson => {
            res.response = responseJson;
//                this.logDebug('TODO  response.json() ==>', responseJson);
            return res;
        });
    };

    // --- Fetch Data Helper
    // --- ---------------------------

    _fetchInitDataContentSerializer(opt) {
        if (opt.data) {
            opt.content = this._dataSerializerEntity(opt.data);
        }
        return opt;
    };

    _fetchInitDataContentRegister(opt) {
        const init = opt.init;
        const content = opt.content;
        if (content) {
            const contentLength = content.length;
            init.body = content;
            // Complete Headers
            const myHeaders = init.headers || new Headers();
            myHeaders.append("Content-Length", contentLength.toString());
            init.headers = myHeaders;
        }
        return opt;
    };

    // --- Fetch Digest Content for Integrity
    // --- ---------------------------

//        _fetchInitDataIntegrity(opt) {
//            let content = opt.content;
//            if (content) {
//                let integrityAlgo = 'SHA-384'; // allowed prefixes are sha256, sha384, and sha512
//                return this._digestPromise(integrityAlgo, content, 'base64')
//                        .then(function (integrityHash) {
//                            opt.integrity = integrityHash;
//                            this.logDebug('integrity : ',opt);
//                            return opt;
//                        });
//            }
//            return opt;
//        };


    // --- Fetch Promise Logic
    // --- ---------------------------
    _fetchPromiseRetrieveRequest(entityId) {
        return this._fetchInitRetrieve(entityId)
            .then(this._fireRequestBegin.bind(this))
            .then(this._fetchRequest.bind(this)) // Do Request
            .then(this._checkResponseStatus.bind(this))
            .then(this._transformResponseJson.bind(this))
            .then(this._adapterResponseRetrieve.bind(this))
    };

    _fetchPromiseRetrieve(entityId) {
        return this._fetchPromiseRetrieveRequest(entityId)
            .then(this._handleTracingEnd.bind(this))
            .then(this._handleResponseRetrieve.bind(this))
            .then(this._fireResponseRetrieve.bind(this))
            .catch(this._handleErrorRetrieve.bind(this));
    };

    _fetchPromiseUpdate(entityId, data) {
        return this._fetchInitUpdate(entityId, data)
            .then(this._fireRequestBegin.bind(this))
            .then(this._adapterFetchInitDataUpdate.bind(this))
            .then(this._fetchInitDataContentSerializer.bind(this))
            //                    .then(this._fetchInitDataIntegrity.bind(this))
            .then(this._fetchInitDataContentRegister.bind(this))
            .then(this._fetchRequest.bind(this)) // Do Request
            .then(this._checkResponseStatus.bind(this))
            .then(this._transformResponseJson.bind(this))
            .then(this._adapterResponseUpdate.bind(this))
            .then(this._handleTracingEnd.bind(this))
            .then(this._handleResponseUpdate.bind(this))
            .then(this._fireResponseUpdate.bind(this))
            .catch(this._handleErrorUpdate.bind(this));
    };

    _fetchPromiseDelete(entityId, data) {
        return this._fetchInitDelete(entityId, data)
            .then(this._fireRequestBegin.bind(this))
            .then(this._fetchRequest.bind(this)) // Do Request
            .then(this._checkResponseStatus.bind(this))
            .then(this._transformResponseJson.bind(this))
            .then(this._adapterResponseDelete.bind(this))
            .then(this._handleTracingEnd.bind(this))
            .then(this._handleResponseDelete.bind(this))
            .then(this._fireResponseDelete.bind(this))
            .catch(this._handleErrorDelete.bind(this));
    };


    _fetchPromiseCreate(entityId, data) {
        return this._fetchInitCreate(entityId, data)
            .then(this._fireRequestBegin.bind(this))
            .then(this._adapterFetchInitDataCreate.bind(this))
            .then(this._fetchInitDataContentSerializer.bind(this))
            //                    .then(this._fetchInitDataIntegrity.bind(this))
            .then(this._fetchInitDataContentRegister.bind(this))
            .then(this._fetchRequest.bind(this)) // Do Request
            .then(this._checkResponseStatus.bind(this))
            .then(this._transformResponseJson.bind(this))
            .then(this._adapterResponseCreate.bind(this))
            .then(this._handleTracingEnd.bind(this))
            .then(this._handleResponseCreate.bind(this))
            .then(this._fireResponseCreate.bind(this))
            .catch(this._handleErrorCreate.bind(this));
    };


    // --- Response Handler
    // --- ---------------------------
    _handleStoreLastResponse(res) {
        this.lastResponse = Object.freeze(res);
        return res;
    }

    _handleResponseRetrieve(res) {
        this._handleStoreLastResponse(res);
        const responseJson = res.response;
        this._setCrudDataModeUpdate(responseJson);
        this.entityId = responseJson.id;
        return res;
    };

    _handleResponseCreate(res) {
        this._handleStoreLastResponse(res);
        const data = this.data;
        const responseJson = res.response;
        const entityId = responseJson.id;
        // Hydrate
        if (this.reloadOnCreate) {
            return this._fetchPromiseRetrieveRequest(entityId)
                .then(this._handleResponseRetrieve.bind(this))
                .then(function (resGet) {
                    return res;
                });
        } else {
            return new Promise(function (resolve, reject) {
                data.id = entityId;
                if (responseJson.version) {
                    data.version = responseJson.version;
                }
                this.entityId = entityId;
                // Propage Modification
                this._setCrudDataModeUpdate(data);
                resolve(res);
            }.bind(this));
        }
    };


    _handleResponseUpdate(res) {
        this._handleStoreLastResponse(res);
        const data = this.data;
        const responseJson = res.response;
        if (responseJson.version) {
            data.version = responseJson.version;
        }
        // Propage Modification
        this._setCrudDataModeUpdate(data);
        return res;
    };

    _handleResponseDelete(res) {
        this._handleStoreLastResponse(res);
        this.clean();
        return res;
    };


    // --- Error handling
    // --- ---------------------------

    _logError(error) {
        console.warn('--- error : ' + error, error.stack);
    };

    _handleErrorRetrieve(error) {
        this._logError(error);
        this._handleTracingError(error, 'retrieve');
        const handlerStatus = this._getHandlerResponseWithSpecificStatus('_handleErrorRetrieve', error);
        if (handlerStatus) {
            return handlerStatus(error);
        }
        this._setCrudDataModeUnset(null);
        this._fireErrorRetrieve(error);
        return error;
    };

    _handleErrorUpdate(error) {
        this._logError(error);
        this._handleTracingError(error, 'update');
        const handlerStatus = this._getHandlerResponseWithSpecificStatus('_handleErrorUpdate', error);
        if (handlerStatus) {
            return handlerStatus(error);
        }
        this._fireErrorUpdate(error);
        return error;
    };

    _handleErrorCreate(error) {
        this._logError(error);
        this._handleTracingError(error, 'create');
        const handlerStatus = this._getHandlerResponseWithSpecificStatus('_handleErrorCreate', error);
        if (handlerStatus) {
            return handlerStatus(error);
        }
        this._fireErrorCreate(error);
        return error;
    };

    _handleErrorDelete(error) {
        this._logError(error);
        this._handleTracingError(error, 'delete');
        const handlerStatus = this._getHandlerResponseWithSpecificStatus('_handleErrorDelete', error);
        if (handlerStatus) {
            return handlerStatus(error);
        }
        this._fireErrorDelete(error);
        return error;
    };


    // --- Specific Error handling
    // --- ---------------------------
    /**
     * Manage Response Error for an request Type an status code
     * Search in code some function for a prefix and a specific status
     * ex: _handleErrorRetrieve409()
     * ex: _handleErrorUpdate409()
     * ex: _handleErrorDelete409()
     * ex: _handleErrorCreate409()
     *
     *
     * @return the function
     */
    _getHandlerResponseWithSpecificStatus(baseErrorFuncName, response) {
        const status = response.status;
        if (status) {
            const errorStatusFunc = baseErrorFuncName + status;
            const handlerForStatus = this[errorStatusFunc];
            if (typeof  handlerForStatus === 'function') {
                // Manage Method Like : _handleErrorUpdate409
                return handlerForStatus;
            }
        }
        return null;
    };

    // --- Event Staus
    // --- ---------------------------
    /**
     * Fired when a status as changed.
     *
     * @event air-cruddy-status
     */
    _fireStatusChanged(status) {
        this.dispatchEvent(new CustomEvent('air-cruddy-status', {detail: {status}, bubbles: true, composed: true}));
        this.logDebug('air-cruddy-status : ', JSON.stringify(status));
        return status;
    };

    // --- Event Request
    // --- ---------------------------

    /**
     * Fired when a resource are loaded.
     *
     * @event air-cruddy-request
     */
    _fireRequestBegin(request) {
        const detail = {
            url: request.url,
            info: request.info
        }
        this.dispatchEvent(new CustomEvent('air-cruddy-request', {
            detail: detail,
            bubbles: true,
            composed: true
        }));
        this.logDebug('Fire  air-cruddy-request : ', JSON.stringify(detail));
        return request;
    };


    // --- Event Response
    // --- ---------------------------

    /**
     * Fired when a response is receive
     *
     * @event air-cruddy-response
     */
    _fireResponse(response) {
        this.dispatchEvent(new CustomEvent('air-cruddy-response', {
            detail: response,
            bubbles: true,
            composed: true
        }));
        return response;
    }

    /**
     * Fired when a resource are loaded.
     *
     * @event air-cruddy-retrieve
     */
    _fireResponseRetrieve(response) {
        this.dispatchEvent(new CustomEvent('air-cruddy-retrieve', {
            detail: response,
            bubbles: true,
            composed: true
        }));
        return this._fireResponse(response);
    };

    /**
     * Fired when a resource are updated.
     *
     * @event air-cruddy-update
     */
    _fireResponseUpdate(response) {
        this.dispatchEvent(new CustomEvent('air-cruddy-update', {detail: response, bubbles: true, composed: true}));
        return this._fireResponse(response);
    };

    /**
     * Fired when a resource are created.
     *
     * @event air-cruddy-create
     */
    _fireResponseCreate(response) {
        this.dispatchEvent(new CustomEvent('air-cruddy-create', {detail: response, bubbles: true, composed: true}));
        return this._fireResponse(response);
    };

    /**
     * Fired when a resource are deleted.
     *
     * @event air-cruddy-delete
     */
    _fireResponseDelete(response) {
        this.dispatchEvent(new CustomEvent('air-cruddy-delete', {detail: response, bubbles: true, composed: true}));
        return this._fireResponse(response);
    };

    // --- Event Error
    // --- ---------------------------

    /**
     * Fired error when a resource are loaded.
     *
     * @event air-cruddy-error-retrieve
     */
    _fireErrorRetrieve(error) {
        this.dispatchEvent(new CustomEvent('air-cruddy-error-retrieve', {
            detail: error,
            bubbles: true,
            composed: true
        }));
        return this._fireError(error, 'retrieve');
    };

    /**
     * Fired error when a resource are loaded.
     *
     * @event air-cruddy-error-update
     */
    _fireErrorUpdate(error) {
        this.dispatchEvent(new CustomEvent('air-cruddy-error-update', {
            detail: error,
            bubbles: true,
            composed: true
        }));
        return this._fireError(error, 'update');
    };

    /**
     * Fired error when a resource are loaded.
     *
     * @event air-cruddy-error-delete
     */
    _fireErrorDelete(error) {
        this.dispatchEvent(new CustomEvent('air-cruddy-error-delete', {
            detail: error,
            bubbles: true,
            composed: true
        }));
        return this._fireError(error, 'delete');
    };

    /**
     * Fired error when a resource are loaded.
     *
     * @event air-cruddy-error-create
     */
    _fireErrorCreate(error) {
        this.dispatchEvent(new CustomEvent('air-cruddy-error-create', {
            detail: error,
            bubbles: true,
            composed: true
        }));
        return this._fireError(error, 'create');
    };

    /**
     * Fired when error is raised
     *
     * @event air-cruddy-error
     */
    _fireError(error) {
        this.dispatchEvent(new CustomEvent('air-cruddy-error', {detail: error, bubbles: true, composed: true}));
        return error;
    };


    // --- Tools
    // --- ---------------------------

    /**
     * Generate a UUID
     */
    uuidv4() {
        const cryptoObj = window.crypto || window.msCrypto;
        return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
            (c ^ cryptoObj.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
        )
    }

    /**
     * Deep clone Object
     * @param obj The object to clone
     * @return the clone
     */
    cloneObject(obj) {
        return obj ? JSON.parse(JSON.stringify(obj)) : obj;
    }

    /**
     * Frozen Deep clone Object
     * @param obj The object to clone
     * @return the clone
     */
    cloneFreezeObject(obj) {
        return obj ? Object.freeze(JSON.parse(JSON.stringify(obj))) : obj;
    }


    /**
     * Visist all child nodes of parent in order to find filter nodes
     * @param parent to visit
     * @param filter for the nodes
     * @param visitChildNodes Visit all child nodes
     * @returns A Array Od filters nodes
     * @private
     */
    _computeFilterNodes(parent, filter, visitChildNodes = true) {
        const levelToVisit = visitChildNodes ? -1 : 1;
        return FiveElements.AirVisitorNodesUtils.computeFilterNodes(parent, filter, levelToVisit);
    };

};