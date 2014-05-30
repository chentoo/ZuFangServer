require("cloud/app.js");
var House = AV.Object.extend("House");

AV.Cloud.define("hello", function(request, response) {
  response.success("Hello world!");
});

if(__production)
{
	AV.Cloud.setInterval("saveDoubanHouse", 30, function(){
		try
		{
			AV.Cloud.httpRequest({
				url: 'http://www.douban.com/group/shanghaizufang/discussion',
				params: 'start=0',
				headers: {
				    'User-Agent':'Mozilla/5.0 (Linux; U; Android 2.2.1; zh-cn; HTC_Wildfire_A3333 Build/FRG83D) AppleWebKit/533.1 (KHTML, like Gecko) Version/4.0 Mobile Safari/533.1'
				},
				success: function(httpResponse) {
					console.log(httpResponse.text);
					parseHtml(httpResponse.text);
				},
				error: function(httpResponse) {
					console.error('Request failed with response code ' + httpResponse.status);
				}
			});
		} catch (err) {

		}
	});
}

if(__production)
{
	AV.Cloud.setInterval("saveHouseContentAndImages", 4, function(){
		try
		{
			var houseQuery = new AV.Query("House");
			houseQuery.doesNotExist("content");			
			houseQuery.ascending("createdAt");

			houseQuery.limit(1);
			houseQuery.skip(1);
			houseQuery.find({
				success: function(houses) {
					if (houses.length > 0) {
						var house = houses[0];
						getHouseContentAndImages(house);
					};
				},
				error:function(error) {
					response.send(500);
				}
			});


		} catch (err) {

		}
	});
}


function parseHtml(html)
{
	var indexOfTr = html.indexOf('<tr class="">');
	if (indexOfTr == -1) {
		return;
	}
	var step1text = html.substring(indexOfTr + 14);

	var indexOfTrEnd = step1text.indexOf('</tr>');
	var step2text = step1text.substring(0, indexOfTrEnd);

	var otherText = step1text.substring(indexOfTrEnd);

	parseHouseDate(step2text);
	parseHtml(otherText);
}

function parseHouseDate(houseDate)
{
	var url = stringWithStartEnd(houseDate, '<a href="', '" title=');

	var title = stringWithStartEnd(houseDate, 'title="', '" class=');

	houseDate = houseDate.substring(houseDate.indexOf(title) + title.length);
	var userUrl = stringWithStartEnd(houseDate, 'nowrap="nowrap"><a href="', '" class="">');
	houseDate = houseDate.substring(houseDate.indexOf(userUrl) + userUrl.length);

	var userNickname = stringWithStartEnd(houseDate , '" class="">', '</a>');
	var commentCount = stringWithStartEnd(houseDate , 'nowrap" class="">', '</td>');
	var updateTime 	 = stringWithStartEnd(houseDate , 'class="time">', '</td>');

	// console.log(url + '\ntitle:' + title + '\nuserUrl:' + userUrl + '\nnicekName:' + userNickname + '\ncommentCount:' + commentCount + '\nupdateTime:' + updateTime);
	saveToAVOS(url, title, userUrl, userNickname, commentCount, updateTime);
}

function stringWithStartEnd(baseString, startString, endString)
{
	var indexOfStart = baseString.indexOf(startString);
	var indexOfEnd = baseString.substring(indexOfStart + startString.length).indexOf(endString);
	if (indexOfStart == -1 || indexOfEnd == -1) {
		return null;
	};
	var result = baseString.substring(indexOfStart + startString.length, indexOfStart + startString.length + indexOfEnd);
	return result;
}

function saveToAVOS(houseUrl, title, userUrl, userNickname, commentCount, updateTime)
{
	try
	{
		var houseQuery = new AV.Query("House");
		houseQuery.equalTo("houseUrl",houseUrl);
		houseQuery.find({
			success: function(houses) {

			  	if(houses.length > 0)//house 存在
			  	{
			  		var house = houses[0];
			  		if (house.get('title') != title) {
						console.log("-----title:" + title + "old title:" + house.get('title'));
				  		house.set('title', title);
				  		house.set("updateTime", updateTime);
				  		house.save(null, {
						success: function(thisHouse) {
						  	console.log("-----【更新存储数据】-----【更新House】-----✓✓✓ 保存成功:" + houseUrl);
						},
						error: function(thisHouse, error) {
						  	console.log("-----【更新存储数据】-----【更新House】-----XXX 保存失败" + error)
						}});

			  		};
				}
			  	else
			  	{
					var house = new House();

					house.set("houseUrl", houseUrl);
					house.set("title", title);
					house.set("userUrl", userUrl);
					house.set("userNickname", userNickname);
					house.set("commentCount", commentCount);
					house.set("updateTime", updateTime);

					house.save(null, {
					success: function(thisHouse) {
					  	console.log("-----【处理存储数据】-----【存储House】-----✓✓✓ 保存成功:" + houseUrl);
					},
					error: function(thisHouse, error) {
					  	console.log("-----【处理存储数据】-----【存储House】-----XXX 保存失败" + error)
					}
				});
			  	}
			},
			error:function(error) {
				response.send(500);
			}
		});
	}catch (err) {
		console.dir(err);
	}
}



function getHouseContentAndImages(house)
{
	house.set('content', 'done');
	house.save();
	var houseContentUrl = house.get('houseUrl');
	try
	{
		AV.Cloud.httpRequest({
			url: houseContentUrl,
			headers: {
			    'User-Agent':'Mozilla/5.0 (Linux; U; Android 2.2.1; zh-cn; HTC_Wildfire_A3333 Build/FRG83D) AppleWebKit/533.1 (KHTML, like Gecko) Version/4.0 Mobile Safari/533.1'
			},
			success: function(httpResponse) {
				// console.log(httpResponse.text);
				parseContentAndImages(httpResponse.text, house);
			},
			error: function(httpResponse) {
				console.error('Request failed with response code ' + httpResponse.status);
			}
		});
	} catch (err) {

	}
}

function parseContentAndImages(httpData, house)
{
	var needParse = stringWithStartEnd(httpData, '<div class="topic-content">', '<div class="sns-bar"');
	// console.log(needParse);
	parseContent(needParse, house);
}

function parseContent(needParse, house)
{
	var content = stringWithStartEnd(needParse, '<div class="topic-figure cc">', '</div>');
	if (content == null) {
		return;
	};
	var imageUrl = stringWithStartEnd(content, '<img src="', '" alt=');
	if (imageUrl != null && imageUrl != undefined && imageUrl.length > 0) {
		console.log('imageUrl' + imageUrl+ "    ");
		house.addUnique("images", imageUrl);
		house.save();
	};
	otherText = needParse.substring(needParse.indexOf(content) + content.length);
	parseContent(otherText, house);
}
// 	// needParse = needParse.substring(houseDate.indexOf(content) + content.length);
// 	// while ()
// }

// function parseWithContentP(needParse)
// {
// 	var content = stringWithStartEnd(needParse, '<p>', '</p>');
// 	needParse = needParse.substring(houseDate.indexOf(content) + content.length);
// }





 