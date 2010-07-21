/* -*- Mode: java; tab-width: 2; c-tab-always-indent: t; indent-tabs-mode: t; c-basic-offset: 2 -*- */

function jsInclude(files, target) {
	let loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
		.getService(Components.interfaces.mozIJSSubScriptLoader);
	for (let i = 0; i < files.length; i++) {
		try {
			loader.loadSubScript(files[i], target);
		}
		catch(e) {
			dump("addressbook-overlay.js: failed to include '" + files[i] + "'\n" + e + "\n");
		}
	}
}

jsInclude(["chrome://sogo-integrator/content/sogo-config.js",
					 "chrome://sogo-integrator/content/addressbook/folder-handler.js",
					 "chrome://sogo-integrator/content/general/creation-utils.js",
					 "chrome://sogo-integrator/content/general/subscription-utils.js",
					 "chrome://sogo-integrator/content/messenger/folders-update.js",
					 "chrome://sogo-connector/content/general/preference.service.addressbook.groupdav.js",
					 "chrome://sogo-connector/content/addressbook/folder-handling.js"]);

function openAbCreationDialog() {
	openDialog("chrome://sogo-integrator/content/addressbook/creation-dialog.xul",
						 "addressbookCreate",
						 "dialog,titlebar,modal",
						 this);
}

function openAbSubscriptionDialog() {
	openDialog("chrome://sogo-integrator/content/general/subscription-dialog.xul",
						 "addressbookSubscribe",
						 "dialog,titlebar,modal",
						 this);
}

function openABACLDialog() {
	let dir = GetSelectedDirectory();
	let abDir = (Components.classes["@mozilla.org/rdf/rdf-service;1"]
							 .getService(Components.interfaces.nsIRDFService)
							 .GetResource(dir)
							 .QueryInterface(Components.interfaces.nsIAbDirectory));

	let groupdavPrefService = new GroupdavPreferenceService(abDir.dirPrefId);
	let url = groupdavPrefService.getURL();

	openDialog("chrome://sogo-integrator/content/general/acl-dialog.xul",
						 "addressbookACL",
						 "dialog,titlebar,modal",
						 {url: url,
								 rolesDialogURL: "chrome://sogo-integrator/content/addressbook/roles-dialog.xul"});
}

function openDeletePersonalDirectoryForbiddenDialog() {
	let strings = document.getElementById("bundle_integrator_addressbook");
	alert(strings.getString("deletePersonalABError"));
}

function openDeletePublicDirectoryForbiddenDialog() {
	let strings = document.getElementById("bundle_integrator_addressbook");
	alert(strings.getString("deletePublicABError"));
}

function onDeleteAbDirectory() {
	let dir = GetSelectedDirectory();
	if (isGroupdavDirectory(dir)) {
		let ab = SCGetDirectoryFromURI(dir);
		let prefs = new GroupdavPreferenceService(ab.dirPrefId);
		let url = prefs.getURL();
		let urlParts = url.split("/");
		if (url.indexOf(sogoBaseURL()) == 0
				&& urlParts[urlParts.length - 2] == "personal")
			openDeletePersonalDirectoryForbiddenDialog();
		else {
			if (SCAbConfirmDeleteDirectory(dir)) {
				let selectedDirectory = SCGetDirectoryFromURI(dir);
				let groupdavPrefService
					= new GroupdavPreferenceService(selectedDirectory.dirPrefId);
				let url = groupdavPrefService.getURL();
				if (url.indexOf(sogoBaseURL()) == 0) {
					let elements = url.split("/");
					let dirBase = elements[elements.length-2];
					let handler = new AddressbookHandler();
					if (dirBase.indexOf("_") == -1) {
						if (dirBase != 'personal') {
// 							dump("should delete folder: " + url+ "\n");
							deleteFolder(url, handler);
						}
					}
					else
						unsubscribeFromFolder(url, handler);
				}
				else
					SCDeleteDAVDirectory(dir);
			}
		}
	}
	else if (isCardDavDirectory(dir)) {
		let selectedDirectory = SCGetDirectoryFromURI(dir);
		let cardDavPrefix = "carddav://";
		let url = selectedDirectory.URI.substr(cardDavPrefix.length);
		if (url.indexOf(sogoBaseURL()) == 0)
			openDeletePublicDirectoryForbiddenDialog();
		else
			SCAbDeleteDirectory();
	}
	else
		SCAbDeleteDirectory();
}

function SIDirPaneController() {
}

SIDirPaneController.prototype = {
 supportsCommand: function(command) {
		return (command == "cmd_SOGoACLS"
						|| command == "addressbook_delete_addressbook_command");
	},

 isCommandEnabled: function(command) {
		let result = false;
		
		if (command == "cmd_SOGoACLS") {
			let uri = GetSelectedDirectory();
			if (uri && isGroupdavDirectory(uri)) {
				let ab = SCGetDirectoryFromURI(uri);
				let prefs = new GroupdavPreferenceService(ab.dirPrefId);
				let dirURL = prefs.getURL();
				if (dirURL.indexOf(sogoBaseURL()) == 0) {
					let elements = dirURL.split("/");
					let dirBase = elements[elements.length-2];
					/* FIXME: we don't support usernames with underscores */
					result = (dirBase.indexOf("_") == -1);
				}
			}
		} else if (command == "addressbook_delete_addressbook_command") {
			let uri = GetSelectedDirectory();
			if (uri) {
				let cd;
				let url;
				let deleteMenuIsUnsubscribe = false;
				let ab = SCGetDirectoryFromURI(uri);
				if (isGroupdavDirectory(uri)) {
					let prefs = new GroupdavPreferenceService(ab.dirPrefId);
					url = prefs.getURL();
					cd = false;
				}
				else if (isCardDavDirectory(uri)) {
					let cardDavPrefix = "carddav://";
					url = ab.URI.substr(cardDavPrefix.length);
					cd = true;
				}
				else
					result = true;

				if (!result) {
					if (url.indexOf(sogoBaseURL()) == 0) {
						if (!cd) {
							let urlParts = url.split("/");
							let dirBase = urlParts[urlParts.length - 2];
							if (dirBase != "personal") {
								result = true;
								deleteMenuIsUnsubscribe = (dirBase.indexOf("_") >= -1);
							}
						}
					}
					else
						result = true;
				}

				let deleteMenuItem
					= document.getElementById("dirTreeContext-delete");
				if (deleteMenuIsUnsubscribe) {
					deleteMenuItem.label
						= deleteMenuItem.getAttribute("unsubscribelabel");
				} else {
					deleteMenuItem.label = deleteMenuItem.getAttribute("deletelabel");
				}
			}
		}

		return result;
	},

 doCommand: function(command){},

 onEvent: function(event) {}
};

function subscriptionDialogType() {
	return "contact";
}

function subscriptionGetHandler() {
	return new AddressbookHandler();
}

window.creationGetHandler = subscriptionGetHandler;

function SISetupAbCommandUpdateHandlers(){
	let controller = new SIDirPaneController();

	dirTree = document.getElementById("dirTree");
	if (dirTree)
		dirTree.controllers.appendController(controller);
}

function SICommandUpdate_AddressBook() {
	this.SICommandUpdate_AddressBookOld();
	goUpdateCommand("cmd_SOGoACLS");
	goUpdateCommand("addressbook_delete_addressbook_command");
}

function SIGoUpdateGlobalEditMenuItems() {
	this.SIGoUpdateGlobalEditMenuItemsOld();
	goUpdateCommand("cmd_SOGoACLS");
	goUpdateCommand("addressbook_delete_addressbook_command");
}

function SIGoUpdateSelectEditMenuItems() {
	this.SIGoUpdateSelectEditMenuItemsOld();
	goUpdateCommand("cmd_SOGoACLS");
	goUpdateCommand("addressbook_delete_addressbook_command");
}

function SIOnLoadHandler() {
	this.SICommandUpdate_AddressBookOld = this.CommandUpdate_AddressBook;
	this.CommandUpdate_AddressBook = this.SICommandUpdate_AddressBook;
	this.SIGoUpdateGlobalEditMenuItemsOld = this.goUpdateGlobalEditMenuItems;
	this.goUpdateGlobalEditMenuItems = 	this.SIGoUpdateGlobalEditMenuItems;
	this.SIGoUpdateSelectEditMenuItemsOld = this.goUpdateSelectEditMenuItems;
	this.goUpdateSelectEditMenuItems = this.SIGoUpdateSelectEditMenuItems;

	this.AbDeleteDirectory = this.onDeleteAbDirectory;

	SISetupAbCommandUpdateHandlers();

	let toolbar = document.getElementById("subscriptionToolbar");
	if (toolbar) {
		let ABChecker = new directoryChecker("Contacts");
		toolbar.collapsed = !ABChecker.checkAvailability();
	}
}

window.addEventListener("load", SIOnLoadHandler, false);
