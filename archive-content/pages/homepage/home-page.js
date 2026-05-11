/*******************************************************************************************
	
			New-Home-Page Javascript
	
**************************************************************** Sravan 10-01-2012 **********/

$(document).ready(function () {

    //on page load Reposition the floating objects according to the screen width
    $('img[height="1"]').hide();
    repositionObjects();
    var x = $('.container').outerWidth();
    $('#homePageSlider .slides').children().css({ width: x });
    $('#homePageSlider').loopedSlider();

    // Animate the driller and bubbles on mouse hover
    $('.deepsea-drill #worker').mouseenter(function () {
        $(this).addClass('animated bounce');
        $('.deepsea-drill #bubble-top').addClass('wiggle3x');
        $('.deepsea-drill #bubble-mid').addClass('wiggle2x');
        $('.deepsea-drill #bubble-btm').addClass('wigglex');
    });
    $('.deepsea-drill #worker').mouseleave(function () {
        $(this).removeClass('animated bounce');
        $('.deepsea-drill #bubble-top').removeClass('wiggle3x');
        $('.deepsea-drill #bubble-mid').removeClass('wiggle2x');
        $('.deepsea-drill #bubble-btm').removeClass('wigglex');
    });

    var resolutionX = $(window).outerWidth();
    // Take care of screen resize (mostly ipad orientation or browser minimize)
    $(window).resize(function () {
        repositionObjects(); // reposition objects
        resolutionX = $(window).outerWidth();
    });
    // Remove parallax scroll for screen widths less than 720px
    $(window).bind('scroll', function (e) {
        if (resolutionX > 1024) {
            parallaxScroll();
        }
    });
    // Parallax scrolling

    function parallaxScroll() {
        var scrl = $(window).scrollTop();
        var sec1 = $('.section1');
        var sec2 = $('.section2');
        var sec3 = $('.section3');
        var midBlob = $('.section2 .slot-2-3 .about-blob');
        var pos3 = (86 - (scrl * .015)) + '% 200px';
        var pos2 = (25 + (scrl * .05)) + '%' + (280 - (scrl * 0.2)) + 'px,' + (64 - (scrl * .015)) + '% 120px,0 -300px, 0 0, 0 -400px';

        sec3.css('background-position', pos3);
        sec2.css('background-position', pos2);

        if (scrl < 250) {
            $('.section2 .slot-2-3 .about-blob').css('top', (scrl * 0.3) + 'px');
        } else { }

        //animate the skies
        if (scrl > 540 && scrl < 1200) {
            sec2.css('top', (scrl - 540));
        }
        else {
            sec2.css('top', '0');
        }

        // animate the diver

        if (scrl > 440 && scrl < 900) {
            $('.section3 .slot-0-1 .about-blob').css('padding-top', ((scrl * 0.3) - 100) + 'px');
            if (scrl > 600 && scrl < 900) {
                $('#diver , #thread').addClass('animate');
                $('#diver').css('top', '1300px');
                $('#thread').css('clip', 'rect(0px,5px,950px,0px)');
            }
        }
        else if (scrl > 900) {
            $('.section3 .slot-0-1 .about-blob').css('padding-top', '170px');
            $('#diver , #thread').addClass('animate');
            $('#diver').css('top', '1180px');
            $('#thread').css('clip', 'rect(0px,5px,830px,0px)');
        } else {
            $('.section3 .slot-0-1 .about-blob').css('padding-top', '33px');
            $('#diver , #thread').removeClass('animate');
            $('#diver').css('top', '1180px');
            $('#thread').css('clip', 'rect(0px,5px,830px,0px)');
        }
        $('#climber').css('top', 600 + (scrl * 0.15));

        // show the scroll position
        //var htdp = scrl;
        //$('#ht-dp').text(htdp);

    }

    //function to reposition all the objects relative to window size

    function repositionObjects() {

        var resx = $(window).outerWidth();
        var resy = $(window).outerHeight();
        var widx = $('.section1 .grid').width();
        var offset = ((resx - widx) / 2) + (widx / 3);
        //$('#pix').text(resx + ' x ' + resy);

        // adjust the driller according to the screen resolution
        var dpdrll = $('.deepsea-drill');
        var dpdrllpos = dpdrll.offset();
        dpdrll.offset({ top: '20px', left: (resx - 262) });

        //reposition all the floating objects (spool, thread, climber & diver)
        var sppos = $('#spool').offset();
        var thpos = $('#thread').offset();
        var clpos = $('#climber').offset();
        var dipos = $('#diver').offset();
        var pressparent = $('.press').parent();
        var sec1 = $('.section1');
        $('#spool').offset({ top: sppos.top, left: offset - 55 });
        $('#thread').offset({ top: thpos.top, left: offset - 35 });
        $('#climber').offset({ top: clpos.top, left: offset - 55 });
        $('#diver').offset({ top: dipos.top, left: offset - 95 });

        // reset the classes for slider and leaderboard according to the resolution
        if (resx < 1235) {
            pressparent.removeClass('slot-2-3-4');
            pressparent.addClass('slot-2-3-4-5');
            sec1.find('.slot-0-1-2-3').addClass('slot-0-1-2');
            sec1.find('.slot-4-5').addClass('slot-3-4-5');
            sec1.find('.slot-0-1-2-3').removeClass('slot-0-1-2-3');
            sec1.find('.slot-4-5').removeClass('slot-4-5');
        }
        else {
            pressparent.removeClass('slot-2-3-4-5');
            pressparent.addClass('slot-2-3-4');
            sec1.find('.slot-0-1-2').addClass('slot-0-1-2-3');
            sec1.find('.slot-3-4-5').addClass('slot-4-5');
            sec1.find('.slot-0-1-2').removeClass('slot-0-1-2');
            sec1.find('.slot-4-5').removeClass('slot-3-4-5');
        }
    }
});
//-------------END Input fields label toggle ---------------
$(document).ready(function(){

	var startY = $('#bubble-top').position().top;
	$('#bubblefloat.first').animate({top: '-30px'},10000,'easeInOutQuad', function(){
		$('#bubblefloat.first').remove();
		setInterval(function(){
			$('.origin').clone().addClass('dup').removeClass('origin').appendTo('body');
			$('.dup').animate({top:'-30px'},20000, 'easeInOutQuad',function(){
				$('.dup').first().remove();
			});
		}, 10000);
		
	});
});