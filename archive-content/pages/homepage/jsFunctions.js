
$(document).ready(function () {
    $('img[height="1"]').hide(); //finds all image elements with height="1" (mostly google tracking imgs) and hides them
});

$(document).ready(function () { initDoc(); });
var currentImage = 0;
function initDoc() {
    $(".fanFeatureItem").click(
        function (e) {
            $(".fanFeatureItem").removeClass("highlightedTabGreen");
            $(this).addClass("highlightedTabGreen");
            ShowFeatureContent($(this).attr("id"));
            e.preventDefault();
        });

    $(".validEmail").blur(
        function () {
            $.ajax({
                url: "../Services/JavaUtilities.asmx/IsUniqueEmail",
                data: "{ 'EmailAddress':'" + $(this).val() + "', 'UserID': '" + $(this).attr('id') + "' }",
                type: "post",
                contentType: 'application/json;charset=utf-8',
                dataType: 'json',
                success: function (data) {
                    var valid = eval("(" + data.d + ")");
                    if (valid) {
                        $(this).css("color", "#009900");
                    } else {
                        $(this).css("color", "#990000");
                    }
                }
            });
        });

    $(".date").datetimepicker({ ampm: true, stepMinute: 5 });

    $('div.fade').hover(function () {
        var fade = $('> div', this);

        if (fade.is(':animated')) {
            fade.stop().fadeTo(0, 1);
        } else {
            fade.fadeIn(0);
        }
    }, function () {
        var fade = $('> div', this);
        if (fade.is(':animated')) {
            fade.stop().fadeTo(0, 0);
        } else {
            fade.fadeOut(0);
        }
    });

//    $(".tabs li").mouseover(function () {
//        $(".tab-container").show();
//        $(".tabs li").removeClass("active");
//        $(this).addClass("active");
//        $(".tab-content").hide();
//        var activeTab = $(this).find("a").attr("href");
//        if (activeTab.charAt(0) == "#") {
//            $(activeTab).show();
//        }
//        return false;
//    });

//    $("#header").mouseover(function () {
//        $(".tab-content").hide();
//        $(".tab-container").hide();
//        $(".tabs li").removeClass("active");
//    });

//    $(".tab-content").mouseleave(function () {
//        $(".tab-content").hide();
//        $(".tab-container").hide();
//        $(".tabs li").removeClass("active");
//    });


    $(".eventImgThumb").click(function () {
        var thisSource = $(this).attr("src");
        var largeSource = $(".eventImgLarge").attr("src");

        $(this).attr("src", largeSource.replace("large", "thumb"));
        $(".eventImgLarge").attr("src", thisSource.replace("thumb", "large"));
    });

    $(".container-button").click(function () {
        var idName = "#" + $(this).attr("id") + "-container";
        var containerID = $(this).attr("id") + "-container";

        var allClosed = true;
        var containers = $(".all-event-info .container");
        for (var i = 0; i < containers.length; i++) {
            if (containers.eq(i).css("display") == "block") {
                containers.eq(i).slideToggle("fast", function () {
                    if ($(this).attr("id") != containerID) {
                        $(idName).slideToggle("fast");
                    }
                });
                allClosed = false;
            }
        }

        if (allClosed) {
            $(idName).slideToggle("fast");
        }
    });

    $("#thumber .prev").click(function () {
        var currentSource = $("#eventImgLarge").attr("src");
        var pattern = /\d+\/medium/;
        currentImage--;
        if (currentImage < 0)
            currentImage = eventImageList.length - 1;

        var newSrc = currentSource.replace(pattern, eventImageList[currentImage] + "/medium");
        var newHref = currentSource.replace(pattern, eventImageList[currentImage] + "/large");
        $("#eventImgLarge").attr("src", newSrc);
        $("#eventImgLarge").parent().attr("href", newHref);

        //Counter
        $("#thumber .count").html("Image " + (currentImage + 1) + " of " + eventImageList.length);
    });

    $("a.picture-group").click(function () {
        var currentImgThumb = $("a.picture-group").attr("href");
        $("a.picture-group").attr("href", currentImgThumb);
        $("a#fancybox-left").css("display", "block");
        $("a#fancybox-right").css("display", "block");

        $("#fancybox-left-ico").click(function () {
            var currentLBSource = $("#fancybox-img").attr("src");
            var pattern = /\d+\/large/;
            currentImage--;
            if (currentImage < 0)
                currentImage = eventImageList.length - 1;

            var newLBSrc = currentLBSource.replace(pattern, eventImageList[currentImage] + "/large");
            $("#fancybox-img").attr("src", newLBSrc);
            $("#fancybox-img").css("height", "auto");
            var newLBHeight = $("#fancybox-img").height();
            $("#fancybox-content").css("height", newLBHeight);
        });

        $("#fancybox-right-ico").click(function () {
            var currentLBSource = $("#fancybox-img").attr("src");
            var pattern = /\d+\/large/;
            currentImage++;
            if (currentImage >= eventImageList.length)
                currentImage = 0;
            var newLBSrc = currentLBSource.replace(pattern, eventImageList[currentImage] + "/large");
            $("#fancybox-img").attr("src", newLBSrc);
            $("#fancybox-img").css("height", "auto");
            var newLBHeight = $("#fancybox-img").height();
            $("#fancybox-content").css("height", newLBHeight);
        });

    });


    $("#thumber .next").click(function () {
        var currentSource = $("#eventImgLarge").attr("src");

        var pattern = /\d+\/medium/;
        currentImage++;
        if (currentImage >= eventImageList.length)
            currentImage = 0;

        var newSrc = currentSource.replace(pattern, eventImageList[currentImage] + "/medium");
        var newHref = currentSource.replace(pattern, eventImageList[currentImage] + "/large");
        $("#eventImgLarge").attr("src", newSrc);
        $("#eventImgLarge").parent().attr("href", newHref);
        $("#thumber .count").html("Image " + (currentImage + 1) + " of " + eventImageList.length);
    });

    $("a.single_image").fancybox();

    /* Apply fancybox to multiple items */

    $("a.grouped_elements").fancybox({
        'transitionIn': 'fade',
        'transitionOut': 'fade',
        'speedIn': 600,
        'speedOut': 200,
        'overlayShow': true

    });

    $("a.picture-group").fancybox({
        'transitionIn': 'fade',
        'transitionOut': 'fade',
        'speedIn': 600,
        'speedOut': 200,
        'overlayShow': true

    });
    $(".step-details").hide();

    $(".steps span").click(function () {
        $('.step-details').slideUp("normal");
        $(this).next().slideDown("normal");

    });

    $(".popup").fancybox();

    $(".info ul li .description").hide();
    $(".info ul li .description:eq(0)").show();
    $(".info ul li:first-child").find("a").css("color", "#32a2cb")
    $(".info ul li").mouseover(function () {
        $(this).find("div").show();
        $(".info ul li:first-child").find("a").css("color", "#848484")
        $(this).find("a").css("color", "#32a2cb")
    });
    $(".info ul li").mouseout(function () {
        $(this).find("div").hide();
        $(this).find("a").css("color", "#848484")
        $(".info ul li .description:eq(0)").show();
        $(".info ul li .description:eq(0)").show();
        $(".info ul li:first-child").find("a").css("color", "#32a2cb")
    });

    $("a.list").click(function () {
        $(this).parent().next("ul").slideToggle("fast");
    })

    $("a.jqbookmark").click(function (event) {
        event.preventDefault(); // prevent the anchor tag from sending the user off to the link
        var url = this.href;
        var title = this.title;

        if (window.sidebar) { // Mozilla Firefox Bookmark
            window.sidebar.addPanel(title, url, "");
        } else if (window.external) { // IE Favorite
            window.external.AddFavorite(url, title);
        } else if (window.opera) { // Opera 7+
            return false;
        } else { // for Safari, Konq etc - browsers who do not support bookmarking scripts
            alert('Unfortunately, this browser does not support the requested action,'
			 + ' please bookmark this page manually.');
        }

    });



    //    var containerColor = $("#mainContent").children().next().next().css("background-color");
    //    
    //    $(".sitePage").css("background-color", containerColor);
    //    $("#mainContent").css("background-color", containerColor);

    $("img.info-button").click(function () {
        $(this).next("div").slideToggle();
    })
}

(function ($) {
    $.fn.pinToTop = function (options) {
        var defaults = {},
			options = $.extend(defaults, options);

        return this.each(function () {

            var $obj = $(this);
            var initMargin = parseInt($obj.css('marginTop').replace(/auto/, 0));
            var padTop = 10;
            var distY = 0;
            var initTop = parseInt($obj.css('top'));
            var initOffset = $obj.offset().top;

            function calculateOffset() {
                if (distY >= initOffset - padTop) {
                    $obj.css({
                        position: 'fixed',
                        top: initTop,
                        marginTop: -175
                    });
                } else {
                    $obj.css({
                        position: 'relative',
                        marginTop: initMargin
                    });
                }
            };

            $(window).bind({
                scroll: function (e) {
                    distY = $(window).scrollTop();
                    calculateOffset();
                }
            });

        });
    };
})(jQuery);

$(function () {
    $('.create-sidebar').pinToTop();
});


function slideSwitch() {
    var $active = $("#hero.Home IMG.active");

    if ($active.length == 0) $active = $("#hero.Home IMG:last");

    var $next = $active.next().length ? $active.next()
        : $("#hero.Home IMG:first");

    $active.fadeOut(500, function () {
        $(this).addClass("last-active"); 
     });

    $next.fadeIn(500, function(){
                $(this).addClass("active");        
                $active.removeClass("active last-active");
        });
}

$(function () {
    setInterval("slideSwitch()", 5000);
});





function ticker() {
    var $active = $("#message-scroller p.active");

    if ($active.length == 0) $active = $("#message-scroller p:last");

    var $next = $active.next().length ? $active.next()
        : $("#message-scroller p:first");

    $active.addClass("last-active");

    $next.css({ opacity: 0.0 })
        .addClass("active")
        .animate({ opacity: 1.0 }, 1000, function () {
            $active.removeClass("active last-active");
        });
}

$(function () {
    setInterval("ticker()", 3000);
});





function viewerLoader() {
    $.ajax({
        url: "../Services/JavaUtilities.asmx/GetMainViewerFeatures",
        type: "post",
        contentType: 'application/json;charset=utf-8',
        dataType: 'json',
        success: function (data) { alert(eval("(" + data.d + ")").MainViewerItemList.length); }
    });
}

function ShowFeatureContent(divName) {
    var idName = "#" + divName.replace("Tab", "Content");
    $(".fanFeatureContent").css("display", "none");
    $(idName).css("display", "block");
}

function CloseContainer() {
    $(".tab-content").hide();
    $(".tab-container").hide();
    $(".tabs li").removeClass("active");
}

function FormatCurrency(num) {
    num = num.toString().replace(/\$|\,/g, '');
    if (isNaN(num))
        num = "0";
    sign = (num == (num = Math.abs(num)));
    num = Math.floor(num * 100 + 0.50000000001);
    cents = num % 100;
    num = Math.floor(num / 100).toString();
    if (cents < 10)
        cents = "0" + cents;
    for (var i = 0; i < Math.floor((num.length - (1 + i)) / 3); i++)
        num = num.substring(0, num.length - (4 * i + 3)) + ',' + num.substring(num.length - (4 * i + 3));

    return (((sign) ? '' : '-') + '$' + num + '.' + cents);
}

function roundHour(dateObj) {
    var hour = dateObj.getHours();
    var minute = dateObj.getMinutes();
    if (minute <= 59 && minute >= 30) {
        hour += 1;
    }

    return hour;
}
//popluate States
/* File Created: August 8, 2012 */

function populateStates(selectedCountry, stateSelect, previouslySeletedState) {
    if (selectedCountry != null && selectedCountry != '') {
        $.getJSON('/Services/GetStatesForCountry?countryId=' + selectedCountry,
            function (states) {
                stateSelect.empty();
                $.each(states, function (index, state) {
                    if (previouslySeletedState != null && state.StateID == previouslySeletedState) {
                        stateSelect.append($('<option/>', {
                            value: state.StateID,
                            text: state.StateID,
                            selected: true
                        }));
                    }
                    else {
                        stateSelect.append($('<option/>', {
                            value: state.StateID,
                            text: state.StateID
                        }));

                    }
                });
            });
    }

}
function populateStates(selectedCountry, stateSelect, previouslySeletedState, controller) {
    if (selectedCountry != null && selectedCountry != '') {
        $.getJSON('/' + controller + '/GetStatesForCountry?countryId=' + selectedCountry,
            function (states) {
                stateSelect.empty();
                $.each(states, function (index, state) {
                    if (previouslySeletedState != null && state.StateID == previouslySeletedState) {
                        stateSelect.append($('<option/>', {
                            value: state.StateID,
                            text: state.StateID,
                            selected: true
                        }));
                    }
                    else {
                        stateSelect.append($('<option/>', {
                            value: state.StateID,
                            text: state.StateID
                        }));

                    }
                });
            });
    }

}


