// 标准颜色方案：蓝橙红绿
const standardColors = {
    primary: ["#0288d1", "#ff9800", "#f44336", "#4caf50"],
    line: "#ff9800",
    background: "#e6e6e6"
};

// 创建tooltip
const tooltip = d3.select("body").append("div")
    .attr("class", "tooltip")
    .style("opacity", 0)
    .style("position", "absolute")
    .style("pointer-events", "none")
    .style("background-color", "rgba(0, 0, 0, 0.8)")
    .style("color", "white")
    .style("border-radius", "4px")
    .style("padding", "8px")
    .style("font-size", "12px")
    .style("line-height", "1.4")
    .style("z-index", "1000");


Promise.all([
    d3.json("../../data/course_preferences.json"),
    d3.json("../../data/course_preferences_ciyun.json")
]).then(([data, wordCloudData]) => {
    console.log("课程偏好数据:", data);
    console.log("词云数据:", wordCloudData);


    // 更新KPI指标
    updateKPIs(data);

    // 创建并更新图表
    createPopularCoursesChart(data);
    createCompletionRankChart(data);
    createDualAxisChart(data);

    // 创建词云
    if (wordCloudData) {
        createWordClouds(wordCloudData);
    } else {
        console.warn("未能加载词云数据");
    }
}).catch(error => {
    console.error("加载或处理数据时出错:", error);
    // 显示错误信息给用户
    document.querySelectorAll('.chart-container').forEach(container => {
        container.innerHTML = '<div class="error-message">加载数据失败，请检查数据文件是否存在。</div>';
    });
});

// 更新KPI指标
function updateKPIs(data) {
    document.getElementById("high-completion-rate").textContent =
        (data.high_completion_course_ratio * 100).toFixed(2) + "%";
    document.getElementById("repeat-learning-rate").textContent =
        (data.repeated_learning_rate * 100).toFixed(2) + "%";
    document.getElementById("conversion-rate").textContent =
        (data.course_learning_conversion_rate * 100).toFixed(2) + "%";
}

// 创建词云图
function createWordClouds(data) {
    console.log("Creating word clouds with data:", data);



    // 仅选学未学课程词云
    if (data.selected_only_word_cloud) {
        console.log("Processing selected only word cloud data");
        createWordCloud(data.selected_only_word_cloud, "#selected-only-word-cloud");
    } else {
        console.warn("仅选学未学课程词云数据为空或格式不正确");
    }

    // 实际学习课程词云
    if (data.learned_word_cloud) {
        console.log("Processing learned word cloud data");
        createWordCloud(data.learned_word_cloud, "#learned-word-cloud");
    } else {
        console.warn("实际学习课程词云数据为空或格式不正确");
    }
}

function createWordCloud(words, svgId) {
    console.log("Creating word cloud for", svgId, "with data:", words);



    const svg = d3.select(svgId);
    const width = +svg.node().getBoundingClientRect().width;
    const height = +svg.attr("height");

    // 清除已有内容
    svg.selectAll("*").remove();

    // 保存原始数据的映射，以防D3布局处理时丢失字段
    const originalDataMap = new Map();
    words.forEach(d => {
        originalDataMap.set(d.text, {
            weight: d.weight,
            frequency: d.frequency,
            size: d.size
        });
    });

    // 创建具有willReadFrequently属性的canvas
    const canvas = document.createElement("canvas");
    canvas.setAttribute("willReadFrequently", "true");

    // 设置词云布局
    const layout = d3.layout.cloud()
        .size([width, height])
        .words(words)
        .padding(5)
        .rotate(() => 0)
        .font("Arial")
        .fontSize(d => d.size)
        .canvas(() => canvas)
        .on("end", draw);

    try {
        console.log("Starting layout for", svgId);
        layout.start();
    } catch (error) {
        console.error("创建词云时出错:", error);
    }

    function draw(words) {
        console.log("Drawing word cloud for", svgId, "with processed words:", words);

        const g = svg.append("g")
            .attr("transform", `translate(${width/2},${height/2})`);

        // 创建颜色比例尺
        const color = d3.scaleOrdinal()
            .domain(words.map(d => d.text))
            .range(svgId.includes("selected-only") ? d3.schemeSet2 : d3.schemeSet3);

        const texts = g.selectAll("text")
            .data(words)
            .enter().append("text")
            .style("font-size", d => `${d.size}px`)
            .style("font-family", "Arial")
            .style("fill", d => color(d.text))
            .attr("text-anchor", "middle")
            .attr("transform", d => `translate(${d.x},${d.y})`)
            .text(d => d.text)
            .style("cursor", "pointer");

        // 添加交互效果
        texts.on("mouseover", function(event, d) {
                    // 放大文字并改变颜色
                    d3.select(this)
                        .transition()
                        .duration(200)
                        .style("font-size", `${d.size * 1.2}px`)
                        .style("fill", d3.rgb(color(d.text)).brighter(0.5));

                    // 显示tooltip
                    tooltip.transition()
                        .duration(200)
                        .style("opacity", .9);

                    // 从原始数据映射中获取完整数据
                    const originalData = originalDataMap.get(d.text);
                    console.log("Original data for", d.text, ":", originalData);
                    console.log("Current d object:", d);

                    // 使用原始数据中的权重和频次
                    const weight = originalData ? originalData.weight : d.weight;
                    const frequency = originalData ? originalData.frequency : d.frequency;

                    // 检查权重值是否有效
                    const hasValidWeight = weight !== undefined && weight !== null && !isNaN(weight);
                    const hasValidFrequency = frequency !== undefined && frequency !== null && !isNaN(frequency);

                    let tooltipContent = svgId.includes("selected-only") ?
                        `<div style="font-weight: bold; margin-bottom: 5px;">仅选学未学课程关键词</div>
                         <div>词语：${d.text}</div>
                         ${hasValidWeight ? `<div>权重：${(weight * 100).toFixed(2)}%</div>` : ''}
                         ${hasValidFrequency ? `<div>出现频次：${frequency} 次</div>` : ''}
                         <div style="font-size: 0.9em; color: #ccc; margin-top: 5px;">
                             这些课程被选择但尚未开始学习
                         </div>` :
                        `<div style="font-weight: bold; margin-bottom: 5px;">实际学习课程关键词</div>
                         <div>词语：${d.text}</div>
                         ${hasValidWeight ? `<div>权重：${(weight * 100).toFixed(2)}%</div>` : ''}
                         ${hasValidFrequency ? `<div>出现频次：${frequency} 次</div>` : ''}
                         <div style="font-size: 0.9em; color: #ccc; margin-top: 5px;">
                             这些课程已经开始学习或完成
                         </div>`;

                    tooltip.html(tooltipContent)
                        .style("left", (event.pageX + 10) + "px")
                        .style("top", (event.pageY - 28) + "px");
                })
                .on("mouseout", function(event, d) {
                    d3.select(this)
                        .transition()
                        .duration(200)
                        .style("font-size", `${d.size}px`)
                        .style("fill", color(d.text));
                        
                    tooltip.transition()
                        .duration(500)
                        .style("opacity", 0);
                });
            }
        }

        // 创建最受欢迎课程条形图
        function createPopularCoursesChart(data) {
            const svg = d3.select("#popular-courses-chart");
            // 增加底部边距以适应更长的标签
            const margin = { top: 40, right: 100, bottom: 250, left: 80 };
            const width = +svg.node().getBoundingClientRect().width - margin.left - margin.right;
            const height = +svg.attr("height") - margin.top - margin.bottom;

            // 清除已有内容
            svg.selectAll("*").remove();

            const g = svg.append("g")
                .attr("transform", `translate(${margin.left},${margin.top})`);

            // 处理数据
            const sortedData = Object.entries(data.top_10_popular_courses)
                .map(([course, count]) => ({ course, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 10);

            // 比例尺
            const x = d3.scaleBand()
                .domain(sortedData.map(d => d.course))
                .range([0, width])
                .padding(0.2);

            const y = d3.scaleLinear()
                .domain([0, d3.max(sortedData, d => d.count)])
                .range([height, 0]);

            // 添加坐标轴
            g.append("g")
                .attr("transform", `translate(0,${height})`)
                .call(d3.axisBottom(x))
                .selectAll("text")
                .attr("class", "axis-text")
                .attr("transform", "rotate(-45)")
                .attr("dx", "-0.8em")
                .attr("dy", "0.8em")
                .style("text-anchor", "end")
                .style("font-size", "12px")
                .each(function(d) {
                    // 检查文本长度，如果太长则截断
                    const text = d3.select(this);
                    const words = d.split(/\s+/);
                    if (words.length > 3) {
                        text.text(words.slice(0, 3).join(" ") + "...");
                        // 添加完整标题作为提示
                        text.append("title").text(d);
                    }
                });

            g.append("g")
                .call(d3.axisLeft(y));

            // 添加轴标签
            g.append("text")
                .attr("class", "axis-label")
                .attr("x", width / 2)
                .attr("y", height + margin.bottom - 10)
                .style("text-anchor", "middle")
                .text("课程名称");

            g.append("text")
                .attr("class", "axis-label")
                .attr("transform", "rotate(-90)")
                .attr("x", -height / 2)
                .attr("y", -margin.left + 20)
                .style("text-anchor", "middle")
                .text("学习人数");

            // 计算总学习人数和平均值
            const totalLearners = d3.sum(sortedData, d => d.count);
            const avgLearners = d3.mean(sortedData, d => d.count);

            // 添加平均线
            g.append("line")
                .attr("x1", 0)
                .attr("x2", width)
                .attr("y1", y(avgLearners))
                .attr("y2", y(avgLearners))
                .attr("stroke", standardColors.line)
                .attr("stroke-width", 2)
                .attr("stroke-dasharray", "5,5");

            // 添加平均线标签
            g.append("text")
                .attr("x", width - 10)
                .attr("y", y(avgLearners) - 5)
                .attr("text-anchor", "end")
                .attr("fill", standardColors.line)
                .style("font-size", "12px")
                .text(`平均: ${avgLearners.toFixed(0)}`);

            // 添加柱状图
            const bars = g.selectAll(".bar")
                .data(sortedData)
                .enter().append("rect")
                .attr("class", "bar")
                .attr("x", d => x(d.course))
                .attr("y", height) 
                .attr("width", x.bandwidth())
                .attr("height", 0) 
                .attr("fill", standardColors.primary[0]);

            // 添加动画效果
            bars.transition()
                .duration(800)
                .delay((d, i) => i * 100) // 每个柱子延迟100ms
                .ease(d3.easeBackOut.overshoot(1.2))
                .attr("y", d => y(d.count))
                .attr("height", d => height - y(d.count));

            // 添加增强的交互效果
            bars.on("mouseover", function(event, d) {
                d3.select(this)
                    .transition()
                    .duration(200)
                    .attr("fill", standardColors.primary[1])
                    .style("opacity", 0.8);
                
                tooltip.transition()
                    .duration(200)
                    .style("opacity", .9);
                
                const percentage = ((d.count / totalLearners) * 100).toFixed(1);
                const rank = sortedData.findIndex(item => item.course === d.course) + 1;
                const comparison = d.count >= avgLearners 
                    ? `高于平均值${(d.count - avgLearners).toFixed(0)}人`
                    : `低于平均值${(avgLearners - d.count).toFixed(0)}人`;
                
                tooltip.html(`
                    <div style="font-weight: bold; margin-bottom: 5px;">课程受欢迎度排名</div>
                    <div><strong>课程名称：</strong>${d.course}</div>
                    <div><strong>学习人数：</strong>${d.count.toLocaleString()}人</div>
                    <div><strong>占比：</strong>${percentage}%</div>
                    <div><strong>排名：</strong>第${rank}名</div>
                    <div><strong>与平均值比较：</strong>${comparison}</div>
                `)
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 28) + "px");
            })
            .on("mouseout", function() {
                d3.select(this)
                    .transition()
                    .duration(200)
                    .attr("fill", standardColors.primary[0])
                    .style("opacity", 1);
                
                tooltip.transition()
                    .duration(500)
                    .style("opacity", 0);
            });

            // 添加数值标签（可选，当柱状图高度足够时显示）
            g.selectAll(".value-label")
                .data(sortedData)
                .enter().append("text")
                .attr("class", "value-label")
                .attr("x", d => x(d.course) + x.bandwidth() / 2)
                .attr("y", d => y(d.count) - 5)
                .attr("text-anchor", "middle")
                .style("font-size", "11px")
                .style("fill", "#666")
                .text(d => d.count);
        }

        // 创建课程完成度排名条形图
        function createCompletionRankChart(data) {
            const svg = d3.select("#completion-rank-chart");
            // 增加底部边距以适应更长的标签
            const margin = { top: 40, right: 100, bottom: 250, left: 80 };
            const width = +svg.node().getBoundingClientRect().width - margin.left - margin.right;
            const height = +svg.attr("height") - margin.top - margin.bottom;

            // 清除已有内容
            svg.selectAll("*").remove();

            const g = svg.append("g")
                .attr("transform", `translate(${margin.left},${margin.top})`);

            // 处理数据
            const sortedData = Object.entries(data.course_completion_avg)
                .map(([course, rate]) => ({ course, rate }))
                .sort((a, b) => b.rate - a.rate)
                .slice(0, 10);

            // 计算平均完成率
            const avgCompletion = d3.mean(sortedData, d => d.rate);

            // 比例尺
            const x = d3.scaleBand()
                .domain(sortedData.map(d => d.course))
                .range([0, width])
                .padding(0.2);

            const y = d3.scaleLinear()
                .domain([0, 1])
                .range([height, 0]);

            // 修改x轴标签样式
            g.append("g")
                .attr("transform", `translate(0,${height})`)
                .call(d3.axisBottom(x))
                .selectAll("text")
                .attr("class", "axis-text")
                .attr("transform", "rotate(-45)")
                .attr("dx", "-0.8em")
                .attr("dy", "0.8em")
                .style("text-anchor", "end")
                .style("font-size", "12px")
                .each(function(d) {
                    // 检查文本长度，如果太长则截断
                    const text = d3.select(this);
                    const words = d.split(/\s+/);
                    if (words.length > 3) {
                        text.text(words.slice(0, 3).join(" ") + "...");
                        // 添加完整标题作为提示
                        text.append("title").text(d);
                    }
                });

            g.append("g")
                .call(d3.axisLeft(y).tickFormat(d => (d * 100) + "%"));

            // 添加标题
            g.append("text")
                .attr("class", "axis-label")
                .attr("x", width / 2)
                .attr("y", height + margin.bottom - 10)
                .style("text-anchor", "middle")
                .text("课程名称");

            g.append("text")
                .attr("class", "axis-label")
                .attr("transform", "rotate(-90)")
                .attr("x", -height / 2)
                .attr("y", -margin.left + 20)
                .style("text-anchor", "middle")
                .text("平均完成度");

            // 添加网格线
            g.append("g")
                .attr("class", "grid")
                .attr("opacity", 0.1)
                .call(d3.axisLeft(y)
                    .tickSize(-width)
                    .tickFormat(""));

            // 添加平均值参考线
            const avgLine = g.append("g")
                .attr("class", "average-line");

            avgLine.append("line")
                .attr("x1", 0)
                .attr("x2", width)
                .attr("y1", y(avgCompletion))
                .attr("y2", y(avgCompletion))
                .attr("stroke", standardColors.line)
                .attr("stroke-width", 2)
                .attr("stroke-dasharray", "5,5");

            // 添加平均值标签
            avgLine.append("text")
                .attr("x", width + 5)
                .attr("y", y(avgCompletion))
                .attr("dy", "0.35em")
                .attr("fill", standardColors.line)
                .attr("font-size", "12px")
                .text(`平均: ${(avgCompletion * 100).toFixed(1)}%`);

            // 添加柱状图
            const bars = g.selectAll(".bar")
                .data(sortedData)
                .enter().append("rect")
                .attr("class", "bar")
                .attr("x", d => x(d.course))
                .attr("y", height)
                .attr("width", x.bandwidth())
                .attr("height", 0) 
                .attr("fill", d => d.rate >= avgCompletion ? standardColors.primary[0] : standardColors.primary[1]);

            // 添加动画效果
            bars.transition()
                .duration(800)
                .delay((d, i) => i * 100) // 每个柱子延迟100ms
                .ease(d3.easeBackOut.overshoot(1.2))
                .attr("y", d => y(d.rate))
                .attr("height", d => height - y(d.rate));

            // 添加增强的交互效果
            bars.on("mouseover", function(event, d) {
                d3.select(this)
                    .transition()
                    .duration(200)
                    .attr("fill", standardColors.primary[1])
                    .style("opacity", 0.8);
                
                tooltip.transition()
                    .duration(200)
                    .style("opacity", .9);
                
                const rank = sortedData.findIndex(item => item.course === d.course) + 1;
                const comparison = d.rate >= avgCompletion 
                    ? `高于平均值${((d.rate - avgCompletion) * 100).toFixed(1)}%`
                    : `高于平均值${((avgCompletion - d.rate) * 100).toFixed(1)}%`;
                
                let status = "一般";
                if (d.rate >= 0.8) {
                    status = "优秀";
                } else if (d.rate >= 0.6) {
                    status = "良好";
                } else if (d.rate < 0.4) {
                    status = "待改进";
                }
                
                tooltip.html(`
                    <div style="font-weight: bold; margin-bottom: 5px;">课程完成度排名</div>
                    <div><strong>课程名称：</strong>${d.course}</div>
                    <div><strong>平均完成度：</strong>${(d.rate * 100).toFixed(1)}%</div>
                    <div><strong>排名：</strong>第${rank}名</div>
                    <div><strong>完成度评价：</strong><span style="color: ${status === "优秀" ? "#66bb6a" : status === "良好" ? "#42a5f5" : status === "待改进" ? "#ef5350" : "#ffa726"}">${status}</span></div>
                `)
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 28) + "px");
            })
            .on("mouseout", function(event, d) {
                d3.select(this)
                    .transition()
                    .duration(200)
                    .attr("fill", d.rate >= avgCompletion ? "#0288d1" : "#90caf9")
                    .style("opacity", 1);
                
                tooltip.transition()
                    .duration(500)
                    .style("opacity", 0);
            });

            // 添加数值标签
            g.selectAll(".value-label")
                .data(sortedData)
                .enter().append("text")
                .attr("class", "value-label")
                .attr("x", d => x(d.course) + x.bandwidth() / 2)
                .attr("y", d => y(d.rate) - 5)
                .attr("text-anchor", "middle")
                .style("font-size", "11px")
                .style("fill", "#666")
                .text(d => `${(d.rate * 100).toFixed(1)}%`);
        }

        // 创建双轴图
        function createDualAxisChart(data) {
            const svg = d3.select("#dual-axis-chart");
            // 增加底部边距以适应更长的标签
            const margin = { top: 40, right: 100, bottom: 250, left: 80 };
            const width = +svg.node().getBoundingClientRect().width - margin.left - margin.right;
            const height = +svg.attr("height") - margin.top - margin.bottom;

            // 清除已有内容
            svg.selectAll("*").remove();

            const g = svg.append("g")
                .attr("transform", `translate(${margin.left},${margin.top})`);

            // 处理数据
            const combinedData = Object.keys(data.course_learners)
                .map(course => ({
                    course,
                    learners: data.course_learners[course],
                    completion: data.course_completion_avg[course] || 0
                }))
                .sort((a, b) => b.learners - a.learners)
                .slice(0, 10);

            // 计算平均完成率
            const avgCompletion = d3.mean(combinedData, d => d.completion);

            // 比例尺
            const x = d3.scaleBand()
                .domain(combinedData.map(d => d.course))
                .range([0, width])
                .padding(0.2);

            const y1 = d3.scaleLinear()
                .domain([0, d3.max(combinedData, d => d.learners)])
                .range([height, 0]);

            const y2 = d3.scaleLinear()
                .domain([0, 1])
                .range([height, 0]);

            // 修改x轴标签样式
            g.append("g")
                .attr("transform", `translate(0,${height})`)
                .call(d3.axisBottom(x))
                .selectAll("text")
                .attr("class", "axis-text")
                .attr("transform", "rotate(-45)")
                .attr("dx", "-0.8em")
                .attr("dy", "0.8em")
                .style("text-anchor", "end")
                .style("font-size", "12px")
                .each(function(d) {
                    // 检查文本长度，如果太长则截断
                    const text = d3.select(this);
                    const words = d.split(/\s+/);
                    if (words.length > 3) {
                        text.text(words.slice(0, 3).join(" ") + "...");
                        // 添加完整标题作为提示
                        text.append("title").text(d);
                    }
                });

            g.append("g")
                .call(d3.axisLeft(y1));

            g.append("g")
                .attr("transform", `translate(${width},0)`)
                .call(d3.axisRight(y2).tickFormat(d => (d * 100) + "%"));

            // 添加标题
            g.append("text")
                .attr("class", "axis-label")
                .attr("x", width / 2)
                .attr("y", height + margin.bottom - 10)
                .style("text-anchor", "middle")
                .text("课程名称");

            g.append("text")
                .attr("class", "axis-label")
                .attr("transform", "rotate(-90)")
                .attr("x", -height / 2)
                .attr("y", -margin.left + 20)
                .style("text-anchor", "middle")
                .text("学习人数");

            g.append("text")
                .attr("class", "axis-label")
                .attr("transform", "rotate(-90)")
                .attr("x", -height / 2)
                .attr("y", width + margin.right - 20)
                .style("text-anchor", "middle")
                .text("平均完成度");

            // 添加平均值参考线
            const avgLine = g.append("g")
                .attr("class", "average-line");

            avgLine.append("line")
                .attr("x1", 0)
                .attr("x2", width)
                .attr("y1", y2(avgCompletion))
                .attr("y2", y2(avgCompletion))
                .attr("stroke", "#ff9800")
                .attr("stroke-width", 2)
                .attr("stroke-dasharray", "5,5");

            avgLine.append("text")
                .attr("x", width + 5)
                .attr("y", y2(avgCompletion))
                .attr("dy", "0.35em")
                .attr("fill", "#ff9800")
                .attr("font-size", "12px")
                .text(`平均: ${(avgCompletion * 100).toFixed(1)}%`);

            // 定义完成度颜色
            const completionColors = {
                high: "#66bb6a", 
                medium: "#ffa726", 
                low: "#ef5350"    
            };

            // 添加图例
            const legend = g.append("g")
                .attr("class", "legend")
                .attr("transform", `translate(${width - 300}, -20)`);

            // 学习人数图例（柱状图）
            legend.append("rect")
                .attr("class", "legend-color")
                .attr("x", 0)
                .attr("y", 0)
                .attr("width", 12)
                .attr("height", 12)
                .attr("fill", "#0288d1");

            legend.append("text")
                .attr("x", 20)
                .attr("y", 10)
                .style("font-size", "12px")
                .text("学习人数");

            // 平均完成度图例（折线）
            legend.append("line")
                .attr("x1", 100)
                .attr("x2", 112)
                .attr("y1", 6)
                .attr("y2", 6)
                .attr("stroke", "#f44336")
                .attr("stroke-width", 2);

            legend.append("text")
                .attr("x", 120)
                .attr("y", 10)
                .style("font-size", "12px")
                .text("平均完成度趋势");

            // 添加柱状图
            const bars = g.selectAll(".bar")
                .data(combinedData)
                .enter().append("rect")
                .attr("class", "bar")
                .attr("x", d => x(d.course))
                .attr("y", d => y1(d.learners))
                .attr("width", x.bandwidth())
                .attr("height", d => height - y1(d.learners));

            // 添加折线
            const line = d3.line()
                .x(d => x(d.course) + x.bandwidth() / 2)
                .y(d => y2(d.completion));

            const linePath = g.append("path")
                .datum(combinedData)
                .attr("class", "line")
                .attr("stroke", "#f44336")
                .attr("d", line);

            // 动态获取路径长度并设置动画
            const pathLength = linePath.node().getTotalLength();
            linePath
                .attr("stroke-dasharray", pathLength)
                .attr("stroke-dashoffset", pathLength)
                .transition()
                .duration(2000)
                .ease(d3.easeLinear)
                .attr("stroke-dashoffset", 0);

            // 获取完成度的颜色
            function getCompletionColor(completion) {
                // 基于平均值上下5个百分点来判定
                if (completion >= avgCompletion + 0.05) return completionColors.high; // 优秀：高于平均值5个百分点
                if (completion >= avgCompletion - 0.05) return completionColors.medium; // 一般：平均值上下5个百分点内
                return completionColors.low; // 待改进：低于平均值5个百分点
            }

            // 添加点
            const dots = g.selectAll(".completion-dot")
                .data(combinedData)
                .enter().append("circle")
                .attr("class", "dot")
                .attr("cx", d => x(d.course) + x.bandwidth() / 2)
                .attr("cy", d => y2(d.completion))
                .attr("r", 6)
                .attr("fill", d => getCompletionColor(d.completion))
                .attr("stroke", "#fff")
                .attr("stroke-width", 2);

            // 添加交互提示
            bars.on("mouseover", function(event, d) {
                d3.select(this)
                    .transition()
                    .duration(200)
                    .attr("fill", "#026aa7")
                    .style("opacity", 0.8);
                
                tooltip.transition()
                    .duration(200)
                    .style("opacity", .9);
                
                const rank = combinedData.findIndex(item => item.course === d.course) + 1;
                const learnerComparison = d.learners >= d3.mean(combinedData, item => item.learners) 
                    ? "高于平均水平" : "低于平均水平";
                const completionComparison = d.completion >= avgCompletion 
                    ? `高于平均值${((d.completion - avgCompletion) * 100).toFixed(1)}%`
                    : `低于平均值${((avgCompletion - d.completion) * 100).toFixed(1)}%`;
                
                tooltip.html(`
                    <div style="font-weight: bold; margin-bottom: 5px;">课程学习人数与完成度</div>
                    <div><strong>课程名称：</strong>${d.course}</div>
                    <div><strong>学习人数：</strong>${d.learners.toLocaleString()}人</div>
                    <div><strong>学习人数排名：</strong>第${rank}名 (${learnerComparison})</div>
                    <div><strong>平均完成度：</strong>${(d.completion * 100).toFixed(1)}%</div>
                    <div><strong>完成度比较：</strong>${completionComparison}</div>
                `)
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 28) + "px");
            })
            .on("mouseout", function() {
                d3.select(this)
                    .transition()
                    .duration(200)
                    .attr("fill", "#0288d1")
                    .style("opacity", 1);
                
                tooltip.transition()
                    .duration(500)
                    .style("opacity", 0);
            });

            dots.on("mouseover", function(event, d) {
                const color = getCompletionColor(d.completion);
                d3.select(this)
                    .transition()
                    .duration(200)
                    .attr("r", 8)
                    .attr("stroke-width", 3);
                
                tooltip.transition()
                    .duration(200)
                    .style("opacity", .9);
                
                let status = "一般";
                if (d.completion >= avgCompletion + 0.05) status = "优秀";
                else if (d.completion < avgCompletion - 0.05) status = "待改进";
                
                const comparison = d.completion >= avgCompletion 
                    ? `高于平均值${((d.completion - avgCompletion) * 100).toFixed(1)}%`
                    : `低于平均值${((avgCompletion - d.completion) * 100).toFixed(1)}%`;
                
                tooltip.html(`
                    <div style="font-weight: bold; margin-bottom: 5px;">课程完成度详情</div>
                    <div><strong>课程名称：</strong>${d.course}</div>
                    <div><strong>平均完成度：</strong>${(d.completion * 100).toFixed(1)}%</div>
                    <div><strong>与平均值比较：</strong>${comparison}</div>
                    <div><strong>完成度评价：</strong>${status}</div>
                    <div style="font-size: 0.9em; color: #ccc; margin-top: 5px;">
                        点击可查看更多详情
                    </div>
                `)
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 28) + "px");
            })
            .on("mouseout", function(event, d) {
                d3.select(this)
                    .transition()
                    .duration(200)
                    .attr("r", 6)
                    .attr("stroke-width", 2);
                
                tooltip.transition()
                    .duration(500)
                    .style("opacity", 0);
            });
        }