/*******************************************************************************
*
* JQUERY TAGDRAGON (v1.33, June 2010, by Ferdy Christant - ferdychristant.com)
*
*
* jQuery TagDragon is a versatile jQuery plugin for autosuggest functionality
* of input boxes and texareas. You can learn more about TagDragon at:
*
* http://www.s3maphor3.org/tagdragon
*
* LICENSE
*
* Tagdragon is charityware. It is not free. You can make use of it after making
* a required donation at :
*
* http://www.s3maphor3.org/tagdragon/buy
*
* 100% of the revenue will be used for project JungleDragon, a charitable
* project!
*
******************************************************************************/

"use strict";
(function($)
{
	$.fn.extend({
		tagdragon: function(options)
		{
			console.log("tesiit")
			return this.each(function()
			{
				$.tagdragonz(this, options);
			});
		},
		// the configure function allows users to override options during runtime, after initialization
		tagdragon_configure: function(options)
		{
			return this.trigger("tagdragon_configure", [options]);
		},
		// the load function allows users to trigger the loading and display of the suggestion list,
		// the suggestion list will only show when there are results for the filter and at least
		// options.minchar characters are entered
		tagdragon_load: function()
		{	
			console.log("test");
			return this.trigger("tagdragon_load");
		},
		// the clear function allows user to hide the suggestion list
		tagdragon_clear: function()
		{
			return this.trigger("tagdragon_clear");
		}
	});
	$.tagdragonz = function(input, options)
	{

		// get handle to the tagbox
		var tagbox = input;

		// when users do not specify explicit options, these are the defaults:
		var defaults = {
			field: 'tags', 						// id of input control (textbox or text area)
			url: 'jsontags.php', 				// the remote url to get the suggestion list
			// from
			tagsep: ',', 						// multi-value delimiter of field
			enclose: '', 						// character to enclose multi-word filters
			max: 10, 							// maximum number of results to show in the suggestion
			// list
			cache: true, 						// cache results from suggestion list or not
			delay: 500, 						// pause after which the suggestion list is loaded
			charMin: 1, 						// minimum number of chars for filter before a lookup is done
			dblClick: true, 					// activate suggestion list on double click?
			postData: null, 					// extra post data specified in object notation
			visible: true, 						// indicates whether the lookup list will be shown when there are suggestions
			dataType: 'json', 					// datatype of return results
			onRenderItem: function(row)
			{ return row.tag; }, // callback made before item is rendered into suggestion list
			onSelectItem: function(val) { return true; }, // callback made once a value is selected but before it is inserted
			onSelectedItem: function(val) { return true; }, // callback made once a value is selected but after it is inserted
			onLoadList: function(filter) { return true; }, // callback made before the suggestion list is loaded
			onLoadedList: function(results) { return true; } // callback made after the suggestion list is loaded
		};

		// override the defaults with the explicit options passed by the user
		options = $.extend(defaults, options);

		// get handle to the input field inside the tagbox
		input = $(tagbox).find('#' + options.field); //$('#' + options.field);

		// disable automcomplete for the field, as that will hover over our suggestion list
		$(input).attr("autocomplete", "off");

		// create the markup for the suggestion list and place it directly below the input field
		var lkup = document.createElement('div');
		$(lkup).attr({ 'id': 'tagbox-lkup' });
		$(lkup, tagbox).show();
		input.after(lkup);
		var lkuplst = document.createElement('ol');
		$(lkup, tagbox).append(lkuplst);

		// global vars, mostly used for control/state behavior
		var cursor = -1; // keyboard arrow cursor in suggestion list (0=first position, -1 = no position)
		var length = 0; // length of last suggestion list
		var loading = false; // loading indicator of suggestion list
		var loaded = false; // loaded indicator of suggestion list
		var cacheLst = { lastSearch: "", data: [] }; // in-memory suggestion list, used for containing the rich objects inside
		var inserted = false; // state variable to prevent double suggestion list after inserting a value

		var preg_escape = function(str)
		{
			// escape regular expression string
			return (str + '').replace(/([\/\\\.\+\*\?\[\^\]\$\(\)\{\}\=\!<>\|\:])/g, "\\$1");
		};

		var hideLkup = function()
		{
			// clear the suggestion list and hide it
			$(lkuplst, tagbox).empty();
			$(lkup, tagbox).hide();
			loaded = false;
			inserted = false;
		};


		var insertTag = function(filter, tag)
		{
			// replaces the filter word the user entered with the selected value in the input control

			// current value of input
			var cur = input.val();
			// count the number of words in the filter
			var words = tag.split(' ').length;
			// determine if we need to enclose the filter, based on options and word count
			var enclose = (words > 1) ? options.enclose.length > 0 ? options.enclose : '' : '';
			// calculate the replacement value, case-insensitive
			cur = cur.replace(eval('/' + preg_escape(filter) + '$/i'), enclose + tag + enclose);
			// set the replacement value
			input.val(cur);
			// reinitialize cursor
			cursor = -1;
		};

		var parseFilter = function(val)
		{
			// get the filter entered by the user from the input box
			// if there is no tag seperator specified, the filter simply is the entire value of the input box
			if (options.tagsep.length == 0)
			{
				return val;
			}

			// a tag seperator is specified in the options, check if is entered by the user
			if (val.indexOf(options.tagsep) > -1)
			{
				// there is a tag seperator entered, the filter is everything
				// from the tag seperator to the end of the total value
				// if the tagsep is not a space, trim the leading and trailing
				// spaces
				if (options.tagsep == ' ') { val = val.substring(val.lastIndexOf(options.tagsep) + 1, val.length); }
				else { val = $.trim(val.substring(val.lastIndexOf(options.tagsep) + 1, val.length)); }
			}
			return val;
		};

		var addItem = function(val, filter, index)
		{
			// adds one item to the suggestion list
			// no need to render anything when we are in "back-end" mode
			if (!options.visible) { return; }

			// cache the rich object that was passed
			var row = val;

			// make the callback to onRenderItem, passing along the value,
			// current index, total values and filter
			// this gives users the opportunity to influence the rendered item in the list
			val = options.onRenderItem(val, index, length, filter);

			// create a LI DOM element for the item to add and add it to the lookup list
			var li = document.createElement('li');
			lkuplst.appendChild(li);

			// create an A DOM element and place it inside the new LI
			var aLink = document.createElement('a');

			// set link target to nothing, we will overrule the onclick anyway
			$(aLink).attr({ 'href': '#' });
			// set the link text
			$(aLink, tagbox).text(val);
			// based on index, set class for alternate row styling
			$(aLink, tagbox).addClass(index % 2 == 0 ? 'td-odd' : 'td-even');
			// set the full HTML to insert by highlighting the filter text
			$(aLink, tagbox).html($(aLink, tagbox).text().replace(eval('/(' + preg_escape(filter) + ')/gi'), "<em>$1</em>"));
			// add the created A element to the LI element
			li.appendChild(aLink);

			// hookup the click event of the new A, this should insert the selected value
			$(aLink).click(function(e)
			{
				// make callback to onSelectItem, passing the rich object to the callback,
				// so that users can get additional values besides the flat value that was selected
				options.onSelectItem(row);

				// insert the tag to the input
				insertTag(filter, val);

				// make callback to onSelectItem, passing the rich object to the callback,
				// so that users can get additional values besides the flat value that was selected
				options.onSelectedItem(row);

				// prevent default behavior of clicking the link
				e.preventDefault();

				// cache last search term
				cacheLst = { lastSearch: parseFilter(input.val()) };

				// hide the suggestion list after adding the item
				hideLkup();

				// since we clicked outside the input to select a value from the suggestion list,
				// move the focus back to the input field
				input.focus();
			});

		};
		
		var clearCache = function(){  
		// function suggested by Tommy Crush to allow for run-time control of caching
        cacheLst = { lastSearch: "", data: [] };
        }


		var loadShowList = function(filter, data)
		{
			// loading was successful, to be sure clear the existing list again
			$(lkuplst, tagbox).empty();

			if (data) {

				// set the length of the suggestion list
				length = data ? data.length : 0;

				// cache the list so that we can reuse the rich objects later on
				// store the last seach string after loading the data
				cacheLst = { lastSearch: filter, data: data };

				// reinitialize keyboard arrow counter
				cursor = -1;

				// loop through results and add them to the suggestion list
				for (var i = 0; i < data.length && i < options.max; i++)
				{ addItem(data[i], filter, i); }

				// show the results
				if (options.visible) { $(lkup, tagbox).show(); }

			}

			// set loading to false, this is needed for the delay function
			loading = false;
			loaded = true;

			// make callback to loaded
			options.onLoadedList(data);

		};

		var loadList = function()
		{
			// loads the suggestion list by doing a remote post to the backend script

			// clear insert state, since we are doing a fresh load
			inserted = false;

			// get the latest filter to search for from the input list
			var filter = parseFilter(input.val());

			// check the cache.   we may already have a match to this search.  if we do just skip the ajax call and return
			if (cacheLst.lastSearch == filter)
			{ loadShowList(filter, cacheLst.data); return; }

			// make the callback to the user, so that they can trigger other
			// things before the suggestion list is loaded
			options.onLoadList(filter);

			// clear the existing list
			$(lkuplst, tagbox).empty();

			// do the remote post
			$.ajax({
				type: "POST", // we do a POST, so that we do not have to mess with URL params, length limits and encoding
				url: options.url,
				data: $.extend({ // as data we will post the filter, the max results, and optionally the postdata set by the user in the options
					tag: filter,
					max: options.max
				}, options.postData),
				dataType: options.dataType,
				cache: options.cache,
				success: function(json)
				{
					// check if the search string has changed while we were
					// loading results. if so, call loadlist again
					if (filter != parseFilter(input.val())) { loadList(); }
					else { loadShowList(filter, json); }
				},
				error: function(XMLHttpRequest, textStatus, errorThrown)
				{
					// no result found or an error occured, reinitialize control/state vars
					length = 0;

					// clear the cache.
					cacheLst = { lastSearch: "", data: [] };
					loading = false;
					loaded = false;

					// make callback to loaded
					options.onLoadedList(false);
				}
			});
		};



		var triggerLoad = function()
		{
			// trigger the loading of the suggestion list

			// do not load the suggestion list when we just inserted a value
			if (inserted) { return false; }
			else
			{
				var filter = parseFilter(input.val());

				// see if the user entered enough chars to trigger the suggestion list
				if (filter.length >= options.charMin)
				{
					// load the suggestion list with the delay that was set in the options
					loading = true;
					setTimeout(function() { loadList(); }, options.delay);
				}
				else { hideLkup(); }
			}
		};

		$(input).focus(function(e)
		{
			// when users focus on the field, trigger the load.
			// only show the list if the data in the tag box is different that what is cached for the list
			if (cacheLst.lastSearch != parseFilter(input.val())) { triggerLoad(); }
		});

		$(input).blur(function(e)
		{
			//we want to hide the lookup but we want any click events to fire first. so do a timer event.
			setTimeout(function(e) { hideLkup(); } , 250);
		});

		input.dblclick(function(e)
		{
			// when double click suggest is enabled in the options, trigger the load
			if (options.dblClick && !loading)
			{ triggerLoad(); }
		});

		$(lkuplst, tagbox).blur(function(e)
		{
			// when users click outside our control, hide the suggestion list
			hideLkup();

		});

		var handleSpecials = function(e)
		{
			// handle arrow keys when they are pressed to navigate the
			// suggestion list

			// capture key
			e = e || window.event;
			var key = e.charCode || e.keyCode;

			// do not block any behavior of special keys when we are not navigating the suggestion list
			if (!loaded) { return true; }

			switch (key)
			{
				case 9:
				// TAB key pressed
				// increase cursor counter if it is not at the end of the list already
				cursor = ((cursor + 1) < length) ? cursor + 1 : cursor;
				if (cursor < length)
				{
					// add highlight class to new position, remove highlight
					// class from previous position
					$('li:eq(' + cursor + ')', tagbox).addClass('hl');
					if ((cursor - 1) > -1) { $('li:eq(' + (cursor - 1) + ')', tagbox).removeClass('hl'); }

					// block default behavior (arrow to scroll)
					e.preventDefault();
				}
				break;

				case 40:
				// DOWN key pressed
				// increase cursor counter if it is not at the end of the list already
				cursor = ((cursor + 1) < length) ? cursor + 1 : cursor;
				if (cursor < length)
				{
					// add highlight class to new position, remove highlight class from previous position
					$('li:eq(' + cursor + ')', tagbox).addClass('hl');
					if ((cursor - 1) > -1) { $('li:eq(' + (cursor - 1) + ')', tagbox).removeClass('hl'); }

					// block default behavior (arrow to scroll)
					e.preventDefault();
				}
				break;

				case 38:
				// UP key pressed
				// decrease cursor counter if it is not at the beginning of the list already
				cursor = (cursor - 1 >= 0) ? cursor - 1 : cursor;
				if (cursor >= 0)
				{
					// add highlight class to new position, remove highlight class from previous position
					$('li:eq(' + cursor + ')', tagbox).addClass('hl');
					$('li:eq(' + (cursor + 1) + ')', tagbox).removeClass('hl');

					// block default behavior (arrow to scroll)
					e.preventDefault();
				}
				break;

				case 13:
				// ENTER key pressed
				// block default behavior (form submit). Unfortunately, this does not work in Opera
				if (input[0].type != "textarea") { e.preventDefault(); }
				if (cursor >= 0 && cursor < length)
				{
					var row = cacheLst.data[cursor];
					options.onSelectItem(row);
					// if the cursor was on a valid position, add the selected tag to the input box
					insertTag(parseFilter(input.val()), $('li:eq(' + (cursor) + ')', tagbox).text());

					// callback
					options.onSelectedItem(row);

					// hide the suggestion list after adding the tag to the input box
					e.preventDefault();

					// update cache
					cacheLst = { lastSearch: parseFilter(input.val()) };
					hideLkup();
				}

				break;

				case 27:
				// ESC key pressed
				// hide the lookup list and prevent the default behavior
				hideLkup();
				e.preventDefault();

				break;
			}
		};

		var handleKey = function(e)
		{
			// handle all non-special keys

			// capture key
			e = e || window.event;
			var key = e.charCode || e.keyCode;

			// don't block the enter key, it should work as expected for textareas (new line)
			if (key == 13) { return true; }

			// return false for these special keys, these are handled in handleSpecials()
			if (key > 8 && key < 46 && key != 32) { return false; }

			// non-special key pressed, trigger the load
			if (loading == false) { triggerLoad(); }

			// show the suggestion list when the loading is completed
			if (options.visible) { $(lkup, tagbox).show(); }
		};

		// bind the keyup event for normal keys
		$(input).keyup(handleKey);

		// bind the keydown event for special keys
		$(input).keydown(handleSpecials);

		// bind the setoptions function
		$(tagbox).bind("tagdragon_configure", function() { $.extend(options, arguments[1]); });

		// bind the load function
		$(tagbox).bind("tagdragon_load", function() { triggerLoad(); });

		// bind the clear function
		$(tagbox).bind("tagdragon_clear", function() { hideLkup(); });
	};
})(jQuery);