window.savedPages = function() {

	// Increment when format of saved pages changes
	window.SAVED_PAGES_VERSION = 1;

	function doSave() {
		// Overriden in appropriate platform files
	}

	function doMigration() {
		var d = $.Deferred();
		function onFail(args) {
			d.reject(args);
		}
		var savedPagesDB = new Lawnchair({name:"savedPagesDB"}, function() {
			this.all(function(savedpages) {	
				var toMigrate = {
					'1.1->1.2': []
				};
				$.each(savedpages, function(i, page) {
					if(typeof page.version === "undefined") {
						// 1.1 -> 1.2
						toMigrate['1.1->1.2'].push(page);
					}
				});
				$.each(toMigrate, function(migration, pages) {
					if(migration === "1.1->1.2" && pages.length !== 0) {
						$("#migrating-saved-pages-overlay").show();
						function saveNextPage(curPage) {
							$("#migration-status").html(mw.msg('migrating-saved-page-status', pages[curPage].title));
							app.navigateToPage(pages[curPage].key).done(function() {
								savedPages.saveCurrentPage().done(function() {
									savedPagesDB.remove(pages[curPage].key);
									// curPage + 1 < pages.length
									// since curpage + 1 is what we pass to the next call
									if(curPage < pages.length - 1) {
										saveNextPage(curPage + 1);
									} else {
										d.resolve();
									}
								});
							});
						}
						saveNextPage(0);
					} else {
						d.resolve();
					}
				});
			});
		});

		return d;
	}

	function saveCurrentPage() {
		var d = $.Deferred();
		var MAX_LIMIT = 50;

		var title = app.getCurrentTitle();
		var url = app.getCurrentUrl();

		console.log("url is " + url);
		var savedPagesDB = new Lawnchair({name:"savedPagesDB"}, function() {
			this.keys(function(records) {
				if (records != null) {
					if (records.length > MAX_LIMIT) {
						// we've reached the max limit
						// @todo this is probably not great, remove this :)
						alert(mw.message("saved-pages-max-warning").plain());
					}else{
						savedPagesDB.save({key: app.curPage.getAPIUrl(), title: title, lang: app.curPage.lang, version: SAVED_PAGES_VERSION});
						savedPages.doSave(app.curPage.getAPIUrl(), title).done(function() {
							d.resolve()
						}).fail(function() {
							d.reject();
						});
					}
				}
			});
		});

		return d;
	}

	function onSavedPageClick() {
		var parent = $(this).parents(".listItemContainer");
		var url = parent.data("page-url");
		var lang = parent.data("page-lang");
		var title = parent.data("page-title");
		chrome.showContent();
		app.loadCachedPage(url, title, lang);
	}

	function onSavedPageDelete() {
		var parent = $(this).parents(".listItemContainer");
		var url = parent.data("page-url");
		var title = parent.data("page-title");
		deleteSavedPage(title, url);
	}

	function deleteSavedPage(title, url) {
		chrome.confirm(mw.message('saved-page-remove-prompt', title).plain()).done(function(answer) {
			if (answer) {
				var savedPagesDB = new Lawnchair({name:"savedPagesDB"}, function() {
					this.remove(url, function() {
						chrome.showNotification(mw.message('saved-page-removed', title ).plain());
						$(".listItemContainer[data-page-url=\'" + url + "\']").hide();
					});
				});
			}
		});
	}

	// Removes all the elements from saved pages
	function onClearSavedPages() {
		chrome.confirm(mw.message('clear-all-saved-pages-prompt').plain()).done(function(answer) {
			if (answer) {
				var savedPagesDB = new Lawnchair({name:"savedPagesDB"}, function() {
					this.nuke();
					chrome.showContent();
				});
			}
		});
	}


	function showSavedPages() {
		var template = templates.getTemplate('saved-pages-template');
		var savedPagesDB = new Lawnchair({name:"savedPagesDB"}, function() {
			this.all(function(savedpages) {	
				$('#savedPagesList').html(template.render({'pages': savedpages}));
				$(".savedPage").click(onSavedPageClick);
				$("#savedPages .cleanButton").unbind('click', onClearSavedPages).bind('click', onClearSavedPages);
				$(".deleteSavedPage").click(onSavedPageDelete);
				chrome.hideOverlays();
				$('#savedPages').localize().show();
				chrome.hideContent();
				chrome.setupScrolling('#savedPages .scroller');
			});
		});

	}

	return {
		showSavedPages: showSavedPages,
		saveCurrentPage: saveCurrentPage,
		doSave: doSave,
		doMigration: doMigration
	};
}();
