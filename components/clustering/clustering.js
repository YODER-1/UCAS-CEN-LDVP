const standardColors = {
    primary: ["#0288d1", "#ff9800", "#f44336", "#4caf50"],
    line: "#ff9800",
    background: "#e6e6e6"
};


const tooltip = d3.select("body").append("div")
    .attr("class", "tooltip")
    .style("opacity", 0);


const clusterColors = [...standardColors.primary, "#9c27b0"];


let selectedCluster = null;

const featureNames = {
    "平均学习记录数": "平均学习记录数",
    "平均学习时长(小时)": "平均学习时长",
    "平均单次学习时长": "平均单次时长",
    "平均完成度": "平均完成度",
    "高完成率": "高完成率",
    "放弃率": "放弃率",
    "学习时间标准差": "时间标准差(小时)",
    "晚间学习占比": "晚间学习占比",
    "课程种类数": "课程种类数",
    "重复学习率": "重复学习率"
};


function animatePageElements() {
    d3.selectAll(".kpi-card")
        .style("opacity", 0)
        .style("transform", "translateY(30px)")
        .transition()
        .duration(600)
        .delay((d, i) => i * 100)
        .ease(d3.easeBackOut.overshoot(1.1))
        .style("opacity", 1)
        .style("transform", "translateY(0px)");

    d3.selectAll(".chart-container")
        .style("opacity", 0)
        .style("transform", "translateY(20px)")
        .transition()
        .duration(800)
        .delay((d, i) => i * 150 + 300)
        .ease(d3.easeQuadOut)
        .style("opacity", 1)
        .style("transform", "translateY(0px)");
}


function animateKPIValues(targetId, finalValue, isPercentage = false) {
    const element = d3.select(`#${targetId}`);
    const startValue = 0;

    element.transition()
        .duration(1500)
        .ease(d3.easeQuadOut)
        .tween("text", function() {
            const interpolate = d3.interpolateNumber(startValue, finalValue);
            return function(t) {
                const value = interpolate(t);
                if (isPercentage) {
                    element.text(value.toFixed(1) + "%");
                } else if (targetId === 'user-count') {
                    element.text(Math.round(value).toLocaleString());
                } else {
                    element.text(Math.round(value));
                }
            };
        });
}

// 数据预处：将时间标准差从秒转换为小时
function preprocessData(data) {
    if (!data.cluster_centroids_original_scale) return data;

    const processedData = JSON.parse(JSON.stringify(data)); // 深拷贝

    processedData.cluster_centroids_original_scale.forEach(centroid => {
        if (centroid["学习时间标准差"]) {
            // 将秒转换为小时 (除以3600)
            centroid["学习时间标准差"] = centroid["学习时间标准差"] / 3600;
        }
    });

    return processedData;
}


d3.json("../../data/clustering_results.json").then(rawData => {
    console.log("加载的原始聚类数据:", rawData);

    // 预处理数据
    const data = preprocessData(rawData);
    console.log("预处理后的聚类数据:", data);

    // 重置选中状态
    selectedCluster = null;

    // 启动页面入场动画
    animatePageElements();

    // 更新KPI指标（带动画）
    updateKPIs(data);

    // 延迟创建图表，让页面动画先完成
    setTimeout(() => {
        createPCAScatter(data);
        createClusterDistribution(data);
        createClusterRadar(data);
        createClusterComparison(data);
        createParallelCoordinates(data);
        createCorrelationHeatmap(data);
    }, 500);
});

// 更新KPI指标
function updateKPIs(data) {
    const centroids = data.cluster_centroids_original_scale || [];
    const assignments = data.cluster_assignments || [];
    const pcaData = data.pca_data || [];

    // 聚类数量
    const clusterCount = centroids.length;
    animateKPIValues("cluster-count", clusterCount);

    // 分析科研人员数
    const userCount = assignments.length;
    animateKPIValues("user-count", userCount);

    // 特征维度数（减去cluster列）
    const featureCount = centroids.length > 0 ? Object.keys(centroids[0]).length - 1 : 0;
    animateKPIValues("feature-count", featureCount);

    // 计算聚类分布
    const clusterCounts = {};
    assignments.forEach(d => {
        clusterCounts[d.cluster] = (clusterCounts[d.cluster] || 0) + 1;
    });

    // 最大聚类占比
    const maxClusterSize = Math.max(...Object.values(clusterCounts));
    const largestClusterRatio = (maxClusterSize / userCount * 100);
    animateKPIValues("largest-cluster-ratio", largestClusterRatio, true);

    // 聚类均衡度（基尼系数的反向指标）
    const clusterSizes = Object.values(clusterCounts);
    const avgSize = userCount / clusterCount;
    const variance = d3.variance(clusterSizes);
    const balanceScore = Math.max(0, 100 - (variance / (avgSize * avgSize)) * 100);
    animateKPIValues("balance-score", balanceScore);
}

// 创建PCA散点图
function createPCAScatter(data) {
    const svg = d3.select("#pca-scatter");
    const margin = { top: 40, right: 40, bottom: 60, left: 60 };
    const width = +svg.node().getBoundingClientRect().width;
    const height = 400;

    svg.attr("height", height);
    svg.selectAll("*").remove();

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const pcaData = data.pca_data || [];


    // 创建比例尺
    const x = d3.scaleLinear()
        .domain(d3.extent(pcaData, d => d.PC1))
        .range([0, width - margin.left - margin.right]);

    const y = d3.scaleLinear()
        .domain(d3.extent(pcaData, d => d.PC2))
        .range([height - margin.top - margin.bottom, 0]);

    // 添加坐标轴（带动画）
    const xAxisGroup = g.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0,${height - margin.top - margin.bottom})`)
        .style("opacity", 0);

    const yAxisGroup = g.append("g")
        .attr("class", "y-axis")
        .style("opacity", 0);

    // 坐标轴动画
    xAxisGroup.transition()
        .duration(600)
        .delay(200)
        .ease(d3.easeQuadOut)
        .style("opacity", 1)
        .call(d3.axisBottom(x));

    yAxisGroup.transition()
        .duration(600)
        .delay(300)
        .ease(d3.easeQuadOut)
        .style("opacity", 1)
        .call(d3.axisLeft(y));

    // 添加散点（增强动画）
    const dots = g.selectAll("circle")
        .data(pcaData)
        .enter()
        .append("circle")
        .attr("class", "scatter-dot")
        .attr("cx", d => x(d.PC1))
        .attr("cy", d => y(d.PC2))
        .attr("r", 0)
        .attr("fill", d => clusterColors[d.cluster % clusterColors.length])
        .style("opacity", 0);

    // 增强散点动画效果
    dots.transition()
        .duration(800)
        .delay((d, i) => 200 + (i * 15)) // 在坐标轴后出现，延迟时间减半
        .ease(d3.easeBackOut.overshoot(1.2))
        .attr("r", 4)
        .style("opacity", 0.7);

    // 交互效果
    dots.on("mouseover", function(event, d) {
            d3.select(this)
                .transition()
                .duration(200)
                .attr("r", 6)
                .attr("opacity", 1);

            tooltip.transition()
                .duration(200)
                .style("opacity", .9);
            tooltip.html(`

                        聚类: ${d.cluster}<br>
                        PC1: ${d.PC1.toFixed(3)}<br>
                        PC2: ${d.PC2.toFixed(3)}
                    `)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function() {
            d3.select(this)
                .transition()
                .duration(200)
                .attr("r", 4)
                .attr("opacity", 0.7);
            tooltip.transition()
                .duration(500)
                .style("opacity", 0);
        });

    // 添加坐标轴标签
    g.append("text")
        .attr("class", "axis-label")
        .attr("x", (width - margin.left - margin.right) / 2)
        .attr("y", height - margin.top - margin.bottom + 50)
        .attr("text-anchor", "middle")
        .style("font-size", "12px")
        .style("fill", "#666")
        .text("第一主成分 (PC1)");

    g.append("text")
        .attr("class", "axis-label")
        .attr("transform", "rotate(-90)")
        .attr("x", -(height - margin.top - margin.bottom) / 2)
        .attr("y", -45)
        .attr("text-anchor", "middle")
        .style("font-size", "12px")
        .style("fill", "#666")
        .text("第二主成分 (PC2)");

    // 添加图例（带动画）
    const legend = g.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${width - margin.left - margin.right - 100}, 20)`)
        .style("opacity", 0);

    const clusters = [...new Set(pcaData.map(d => d.cluster))].sort();

    const legendItems = legend.selectAll(".legend-item")
        .data(clusters)
        .enter()
        .append("g")
        .attr("class", "legend-item")
        .attr("transform", (d, i) => `translate(0, ${i * 20})`)
        .style("opacity", 0);

    legendItems.append("circle")
        .attr("r", 6)
        .attr("fill", d => clusterColors[d % clusterColors.length]);

    legendItems.append("text")
        .attr("x", 15)
        .attr("y", 4)
        .style("font-size", "12px")
        .text(d => `聚类 ${d}`);

    // 图例动画
    legend.transition()
        .duration(600)
        .delay(1000)
        .ease(d3.easeQuadOut)
        .style("opacity", 1);

    legendItems.transition()
        .duration(400)
        .delay((d, i) => 1200 + (i * 100))
        .ease(d3.easeBackOut.overshoot(1.1))
        .style("opacity", 1);
}

// 创建聚类分布图
function createClusterDistribution(data) {
    const svg = d3.select("#cluster-distribution");
    const margin = { top: 40, right: 40, bottom: 60, left: 60 };
    const width = +svg.node().getBoundingClientRect().width;
    const height = 400;

    svg.attr("height", height);
    svg.selectAll("*").remove();

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const assignments = data.cluster_assignments || [];

    // 统计每个聚类的科研人员数
    const clusterCounts = {};
    assignments.forEach(d => {
        clusterCounts[d.cluster] = (clusterCounts[d.cluster] || 0) + 1;
    });

    const clusterData = Object.entries(clusterCounts).map(([cluster, count]) => ({
        cluster: parseInt(cluster),
        count: count,
        percentage: count / assignments.length * 100
    })).sort((a, b) => a.cluster - b.cluster);

    // 创建比例尺
    const x = d3.scaleBand()
        .domain(clusterData.map(d => `聚类 ${d.cluster}`))
        .range([0, width - margin.left - margin.right])
        .padding(0.1);

    const y = d3.scaleLinear()
        .domain([0, d3.max(clusterData, d => d.count) * 1.1]) // 恢复正确的数据范围
        .range([height - margin.top - margin.bottom, 0]);

    // 添加坐标轴（带动画）
    const xAxisGroup = g.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0,${height - margin.top - margin.bottom})`)
        .style("opacity", 0);

    const yAxisGroup = g.append("g")
        .attr("class", "y-axis")
        .style("opacity", 0);

    // 坐标轴动画
    xAxisGroup.transition()
        .duration(600)
        .delay(200)
        .ease(d3.easeQuadOut)
        .style("opacity", 1)
        .call(d3.axisBottom(x));

    yAxisGroup.transition()
        .duration(600)
        .delay(300)
        .ease(d3.easeQuadOut)
        .style("opacity", 1)
        .call(d3.axisLeft(y));

    // 添加柱状图（增强动画）
    const bars = g.selectAll("rect")
        .data(clusterData)
        .enter()
        .append("rect")
        .attr("class", "cluster-bar")
        .attr("x", d => x(`聚类 ${d.cluster}`))
        .attr("y", height - margin.top - margin.bottom)
        .attr("width", x.bandwidth())
        .attr("height", 0)
        .attr("fill", d => clusterColors[d.cluster % clusterColors.length])
        .style("opacity", 0);

    // 增强柱状图动画
    bars.transition()
        .duration(1000)
        .delay((d, i) => 500 + (i * 200))
        .ease(d3.easeBackOut.overshoot(1.1))
        .attr("y", d => y(d.count))
        .attr("height", d => height - margin.top - margin.bottom - y(d.count))
        .style("opacity", 0.8);

    // 交互效果
    bars.on("mouseover", function(event, d) {
            d3.select(this)
                .transition()
                .duration(200)
                .attr("opacity", 1);

            tooltip.transition()
                .duration(200)
                .style("opacity", .9);
            tooltip.html(`
                        聚类 ${d.cluster}<br>
                        科研人员数量: ${d.count}<br>
                        占比: ${d.percentage.toFixed(1)}%
                    `)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function() {
            d3.select(this)
                .transition()
                .duration(200)
                .attr("opacity", 0.8);
            tooltip.transition()
                .duration(500)
                .style("opacity", 0);
        });

    // 添加百分比标签（带动画）
    const percentageLabels = g.selectAll(".percentage-label")
        .data(clusterData)
        .enter()
        .append("text")
        .attr("class", "percentage-label")
        .attr("x", d => x(`聚类 ${d.cluster}`) + x.bandwidth() / 2)
        .attr("y", d => y(d.count) - 5)
        .attr("text-anchor", "middle")
        .style("font-size", "12px")
        .style("fill", "#333")
        .style("opacity", 0)
        .text(d => d.percentage.toFixed(1) + "%");

    // 标签动画
    percentageLabels.transition()
        .duration(600)
        .delay((d, i) => 1000 + (i * 200))
        .ease(d3.easeQuadOut)
        .style("opacity", 1);

    // 添加坐标轴标签（带动画）
    const xAxisLabel = g.append("text")
        .attr("class", "axis-label")
        .attr("x", (width - margin.left - margin.right) / 2)
        .attr("y", height - margin.top + 10)
        .attr("text-anchor", "middle")
        .style("opacity", 0)
        .text("聚类");

    const yAxisLabel = g.append("text")
        .attr("class", "axis-label")
        .attr("transform", "rotate(-90)")
        .attr("x", -(height - margin.top - margin.bottom) / 2)
        .attr("y", -40)
        .attr("text-anchor", "middle")
        .style("opacity", 0)
        .text("科研人员数量");

    // 坐标轴标签动画
    xAxisLabel.transition()
        .duration(600)
        .delay(800)
        .ease(d3.easeQuadOut)
        .style("opacity", 1);

    yAxisLabel.transition()
        .duration(600)
        .delay(900)
        .ease(d3.easeQuadOut)
        .style("opacity", 1);
}

// 创建聚类特征雷达图
function createClusterRadar(data) {
    const svg = d3.select("#cluster-radar");
    const width = +svg.node().getBoundingClientRect().width;
    const height = 600;
    const margin = { top: 50, right: 150, bottom: 50, left: 50 };
    const radius = Math.min(width - margin.left - margin.right, height - margin.top - margin.bottom) / 2 - 50;

    svg.attr("height", height);
    svg.selectAll("*").remove();

    const g = svg.append("g")
        .attr("transform", `translate(${width/2},${height/2})`);

    const centroids = data.cluster_centroids_original_scale || [];

    if (centroids.length === 0) return;

    // 获取特征名称（排除cluster列）
    const features = Object.keys(centroids[0]).filter(key => key !== 'cluster');
    const angleSlice = Math.PI * 2 / features.length;

    // 计算每个特征的最大值用于标准化
    const maxValues = {};
    features.forEach(feature => {
        maxValues[feature] = d3.max(centroids, d => Math.abs(d[feature]));
    });

    // 创建径向比例尺
    const rScale = d3.scaleLinear()
        .domain([0, 1])
        .range([0, radius]);

    // 绘制同心圆（带动画）
    const levels = 5;
    const circles = [];
    for (let i = 1; i <= levels; i++) {
        const circle = g.append("circle")
            .attr("r", 0)
            .attr("fill", "none")
            .attr("stroke", "#ccc")
            .attr("stroke-dasharray", "3,3")
            .style("opacity", 0);

        circle.transition()
            .duration(800)
            .delay(i * 100)
            .ease(d3.easeBackOut.overshoot(1.1))
            .attr("r", rScale(i / levels))
            .style("opacity", 0.5);

        circles.push(circle);
    }

    // 绘制轴线和标签（带动画）
    features.forEach((feature, i) => {
        const angle = angleSlice * i - Math.PI / 2;
        const x = rScale(1) * Math.cos(angle);
        const y = rScale(1) * Math.sin(angle);

        const line = g.append("line")
            .attr("x1", 0)
            .attr("y1", 0)
            .attr("x2", 0)
            .attr("y2", 0)
            .attr("stroke", "#ccc")
            .attr("stroke-width", 1)
            .style("opacity", 0);

        // 轴线动画
        line.transition()
            .duration(600)
            .delay(300 + (i * 80))
            .ease(d3.easeQuadOut)
            .attr("x2", x)
            .attr("y2", y)
            .style("opacity", 1);

        // 添加标签
        const labelX = rScale(1.2) * Math.cos(angle);
        const labelY = rScale(1.2) * Math.sin(angle);

        const label = g.append("text")
            .attr("x", labelX)
            .attr("y", labelY)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .style("font-size", "10px")
            .style("opacity", 0)
            .text(featureNames[feature] || feature);

        // 标签动画
        label.transition()
            .duration(400)
            .delay(600 + (i * 80))
            .ease(d3.easeQuadOut)
            .style("opacity", 1);
    });

    // 为每个聚类创建雷达图形状
    centroids.forEach((centroid, clusterIndex) => {
        const clusterData = features.map(feature => ({
            feature: feature,
            value: Math.abs(centroid[feature]) / maxValues[feature]
        }));

        const lineGenerator = d3.lineRadial()
            .angle((d, i) => angleSlice * i)
            .radius(d => rScale(d.value))
            .curve(d3.curveLinearClosed);

        const path = g.append("path")
            .datum(clusterData)
            .attr("class", "radar-line")
            .attr("data-cluster", clusterIndex)
            .attr("d", lineGenerator)
            .attr("fill", clusterColors[clusterIndex % clusterColors.length])
            .attr("fill-opacity", 0)
            .attr("stroke", clusterColors[clusterIndex % clusterColors.length])
            .attr("stroke-width", 0)
            .style("pointer-events", "all");

        // 添加路径动画
        const totalLength = path.node().getTotalLength();
        path
            .attr("stroke-dasharray", totalLength + " " + totalLength)
            .attr("stroke-dashoffset", totalLength)
            .transition()
            .duration(1500)
            .delay(clusterIndex * 300)
            .ease(d3.easeLinear)
            .attr("stroke-dashoffset", 0)
            .attr("stroke-width", 2)
            .transition()
            .duration(500)
            .attr("fill-opacity", 0.1);

        // 交互效果
        path.on("mouseover", function() {
                d3.select(this)
                    .transition()
                    .duration(200)
                    .attr("fill-opacity", selectedCluster === null || selectedCluster === clusterIndex ? 0.3 : 0.1);
            })
            .on("mouseout", function() {
                d3.select(this)
                    .transition()
                    .duration(200)
                    .attr("fill-opacity", selectedCluster === null || selectedCluster === clusterIndex ? 0.1 : 0.05);
            })
            .on("click", function(event) {
                // 防止事件冒泡
                event.stopPropagation();

                console.log("雷达图路径被点击，聚类索引:", clusterIndex, "当前选中:", selectedCluster);

                // 切换选中状态
                if (selectedCluster === clusterIndex) {
                    // 如果当前聚类已被选中，则取消选中
                    selectedCluster = null;
                    console.log("取消选中聚类", clusterIndex);
                } else {
                    // 选中当前聚类
                    selectedCluster = clusterIndex;
                    console.log("选中聚类", clusterIndex);
                }

                // 更新所有聚类的显示状态
                updateRadarClusterVisibility();

                // 显示提示信息
                tooltip.transition()
                    .duration(200)
                    .style("opacity", .9);

                if (selectedCluster === clusterIndex) {
                    tooltip.html(`
                        <div style="font-weight: bold; color: ${clusterColors[clusterIndex % clusterColors.length]}">
                            聚类 ${centroid.cluster} 已选中
                        </div>
                        <div style="font-size: 12px; color: #666; margin-top: 5px;">
                            点击其他区域取消选中
                        </div>
                    `);
                } else {
                    tooltip.html(`
                        <div style="font-weight: bold;">聚类 ${centroid.cluster} 已取消选中</div>
                        <div style="font-size: 12px; color: #666; margin-top: 5px;">
                            点击任意聚类区域进行选中
                        </div>
                    `);
                }

                tooltip
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 28) + "px");

                // 2秒后自动隐藏提示
                setTimeout(() => {
                    tooltip.transition()
                        .duration(500)
                        .style("opacity", 0);
                }, 2000);
            })
            .style("cursor", "pointer");


        clusterData.forEach((d, i) => {
            const angle = angleSlice * i - Math.PI / 2;
            const x = rScale(d.value) * Math.cos(angle);
            const y = rScale(d.value) * Math.sin(angle);

            const dot = g.append("circle")
                .attr("class", "radar-dot")
                .attr("data-cluster", clusterIndex)
                .attr("cx", x)
                .attr("cy", y)
                .attr("r", 0)
                .attr("fill", clusterColors[clusterIndex % clusterColors.length])
                .attr("opacity", 0);


            dot.transition()
                .duration(500)
                .delay(clusterIndex * 300 + i * 100 + 1000)
                .ease(d3.easeBackOut.overshoot(1.2))
                .attr("r", 3)
                .attr("opacity", 1);

            // 数据点交互
            dot.on("mouseover", function(event) {
                    d3.select(this)
                        .transition()
                        .duration(200)
                        .attr("r", 5);

                    tooltip.transition()
                        .duration(200)
                        .style("opacity", .9);

                    // 为时间标准差提供更友好的显示
                    let displayValue = centroid[d.feature].toFixed(2);
                    if (d.feature === "学习时间标准差") {
                        const hours = centroid[d.feature];
                        const days = Math.floor(hours / 24);
                        const remainingHours = (hours % 24).toFixed(1);
                        if (days > 0) {
                            displayValue = `${hours.toFixed(1)}小时 (约${days}天${remainingHours}小时)`;
                        } else {
                            displayValue = `${hours.toFixed(1)}小时`;
                        }
                    }

                    tooltip.html(`
                                聚类 ${centroid.cluster}<br>
                                ${featureNames[d.feature] || d.feature}: ${displayValue}
                            `)
                        .style("left", (event.pageX + 10) + "px")
                        .style("top", (event.pageY - 28) + "px");
                })
                .on("mouseout", function() {
                    d3.select(this)
                        .transition()
                        .duration(200)
                        .attr("r", 3);
                    tooltip.transition()
                        .duration(500)
                        .style("opacity", 0);
                });
        });
    });


    const legend = svg.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${width - 140}, ${height/2 - centroids.length * 12.5})`);

    centroids.forEach((centroid, i) => {
        const legendItem = legend.append("g")
            .attr("transform", `translate(0, ${i * 25})`)
            .style("cursor", "pointer")
            .on("click", function(event) {
                event.stopPropagation();


                if (selectedCluster === i) {
                    selectedCluster = null;
                } else {
                    selectedCluster = i;
                }


                updateRadarClusterVisibility();
            });

        legendItem.append("rect")
            .attr("width", 12)
            .attr("height", 12)
            .attr("fill", clusterColors[i % clusterColors.length]);

        legendItem.append("text")
            .attr("x", 16)
            .attr("y", 10)
            .style("font-size", "11px")
            .style("fill", "#333")
            .text(`聚类 ${centroid.cluster}`);
    });


    svg.on("click", function(event) {
        if (selectedCluster !== null) {
            selectedCluster = null;
            updateRadarClusterVisibility();


            tooltip.transition()
                .duration(200)
                .style("opacity", .9);
            tooltip.html(`
                <div style="font-weight: bold;">已取消所有选中</div>
                <div style="font-size: 12px; color: #666; margin-top: 5px;">
                    点击聚类区域或图例进行选中
                </div>
            `)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px");

            setTimeout(() => {
                tooltip.transition()
                    .duration(500)
                    .style("opacity", 0);
            }, 1500);
        }
    });


    function updateRadarClusterVisibility() {
        console.log("更新雷达图可见性，当前选中聚类:", selectedCluster);


        g.selectAll(".radar-line")
            .transition()
            .duration(300)
            .attr("fill-opacity", function() {
                const pathClusterIndex = parseInt(d3.select(this).attr("data-cluster"));
                console.log("处理路径，聚类索引:", pathClusterIndex, "选中状态:", selectedCluster === pathClusterIndex);
                if (selectedCluster === null) {
                    return 0.1;
                } else if (selectedCluster === pathClusterIndex) {
                    return 0.4;
                } else {
                    return 0.02;
                }
            })
            .attr("stroke-width", function() {
                const pathClusterIndex = parseInt(d3.select(this).attr("data-cluster"));
                if (selectedCluster === null) {
                    return 2;
                } else if (selectedCluster === pathClusterIndex) {
                    return 3;
                } else {
                    return 1;
                }
            })
            .attr("stroke-opacity", function() {
                const pathClusterIndex = parseInt(d3.select(this).attr("data-cluster"));
                if (selectedCluster === null) {
                    return 1;
                } else if (selectedCluster === pathClusterIndex) {
                    return 1;
                } else {
                    return 0.3;
                }
            });


        g.selectAll(".radar-dot")
            .transition()
            .duration(300)
            .attr("opacity", function() {
                const dotClusterIndex = parseInt(d3.select(this).attr("data-cluster"));
                if (selectedCluster === null) {
                    return 1;
                } else if (selectedCluster === dotClusterIndex) {
                    return 1;
                } else {
                    return 0.2;
                }
            })
            .attr("r", function() {
                const dotClusterIndex = parseInt(d3.select(this).attr("data-cluster"));
                if (selectedCluster === null) {
                    return 3;
                } else if (selectedCluster === dotClusterIndex) {
                    return 4;
                } else {
                    return 2;
                }
            });

        legend.selectAll("g")
            .select("rect")
            .transition()
            .duration(300)
            .attr("opacity", function(d, i) {
                if (selectedCluster === null) {
                    return 1;
                } else if (selectedCluster === i) {
                    return 1;
                } else {
                    return 0.3;
                }
            });

        legend.selectAll("g")
            .select("text")
            .transition()
            .duration(300)
            .style("font-weight", function(d, i) {
                if (selectedCluster === i) {
                    return "bold";
                } else {
                    return "normal";
                }
            })
            .style("fill", function(d, i) {
                if (selectedCluster === null) {
                    return "#333";
                } else if (selectedCluster === i) {
                    return clusterColors[i % clusterColors.length];
                } else {
                    return "#999";
                }
            });
    }
}


function createClusterComparison(data) {
    const svg = d3.select("#cluster-comparison");
    const margin = { top: 60, right: 120, bottom: 100, left: 80 };
    const width = +svg.node().getBoundingClientRect().width;
    const height = 500;

    svg.attr("height", height);
    svg.selectAll("*").remove();

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const centroids = data.cluster_centroids_original_scale || [];

    if (centroids.length === 0) return;

    const features = Object.keys(centroids[0]).filter(key => key !== 'cluster');


    const cols = Math.min(4, Math.ceil(Math.sqrt(features.length)));
    const rows = Math.ceil(features.length / cols);

    const horizontalSpacing = 40;
    const verticalSpacing = 60;

    const subChartWidth = (width - margin.left - margin.right - (cols - 1) * horizontalSpacing) / cols;
    const subChartHeight = (height - margin.top - margin.bottom - (rows - 1) * verticalSpacing) / rows * 1.5;


    features.forEach((feature, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);

        const subChartX = col * (subChartWidth + horizontalSpacing);
        const subChartY = row * (subChartHeight + verticalSpacing);


        const subChart = g.append("g")
            .attr("transform", `translate(${subChartX}, ${subChartY})`);


        const featureData = centroids.map(centroid => ({
            cluster: centroid.cluster,
            value: centroid[feature]
        }));

        const chartMargin = { top: 25, right: 10, bottom: 25, left: 35 };
        const chartWidth = subChartWidth - chartMargin.left - chartMargin.right;
        const chartHeight = subChartHeight - chartMargin.top - chartMargin.bottom;

        const x = d3.scaleBand()
            .domain(centroids.map(d => d.cluster))
            .range([0, chartWidth])
            .padding(0.3);

        const y = d3.scaleLinear()
            .domain([0, d3.max(featureData, d => d.value) * 1.1])
            .range([chartHeight, 0]);

        const chartArea = subChart.append("g")
            .attr("transform", `translate(${chartMargin.left}, ${chartMargin.top})`);

        chartArea.append("g")
            .attr("transform", `translate(0, ${chartHeight})`)
            .call(d3.axisBottom(x).tickFormat(d => `C${d}`))
            .selectAll("text")
            .style("font-size", "9px")
            .style("fill", "#666");

        chartArea.append("g")
            .call(d3.axisLeft(y).ticks(3).tickFormat(d => {
                if (feature === "学习时间标准差") {
                    return d.toFixed(0) + "h";
                } else if (d >= 1000) {
                    return (d / 1000).toFixed(1) + "k";
                } else if (d < 1) {
                    return d.toFixed(2);
                } else {
                    return d.toFixed(0);
                }
            }))
            .selectAll("text")
            .style("font-size", "8px")
            .style("fill", "#666");

        const subBars = chartArea.selectAll("rect")
            .data(featureData)
            .enter()
            .append("rect")
            .attr("class", "cluster-bar")
            .attr("x", d => x(d.cluster))
            .attr("y", chartHeight)
            .attr("width", x.bandwidth())
            .attr("height", 0)
            .attr("fill", d => clusterColors[d.cluster % clusterColors.length])
            .attr("opacity", 0.8)
            .attr("stroke", "#fff")
            .attr("stroke-width", 1);


        subBars.transition()
            .duration(600)
            .delay(index * 100 + 300)
            .ease(d3.easeBackOut.overshoot(1.1))
            .attr("y", d => y(d.value))
            .attr("height", d => chartHeight - y(d.value));

        subBars.on("mouseover", function(event, d) {
                d3.select(this)
                    .transition()
                    .duration(200)
                    .attr("opacity", 1);

                tooltip.transition()
                    .duration(200)
                    .style("opacity", .9);

                let displayValue = d.value.toFixed(2);
                if (feature === "学习时间标准差") {
                    const hours = d.value;
                    const days = Math.floor(hours / 24);
                    const remainingHours = (hours % 24).toFixed(1);
                    if (days > 0) {
                        displayValue = `${hours.toFixed(1)}小时 (约${days}天${remainingHours}小时)`;
                    } else {
                        displayValue = `${hours.toFixed(1)}小时`;
                    }
                }

                tooltip.html(`
                            聚类 ${d.cluster}<br>
                            ${featureNames[feature] || feature}<br>
                            数值: ${displayValue}
                        `)
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 28) + "px");
            })
            .on("mouseout", function() {
                d3.select(this)
                    .transition()
                    .duration(200)
                    .attr("opacity", 0.8);
                tooltip.transition()
                    .duration(500)
                    .style("opacity", 0);
            });


        subChart.append("text")
            .attr("x", subChartWidth / 2)
            .attr("y", 15)
            .attr("text-anchor", "middle")
            .style("font-size", "11px")
            .style("font-weight", "bold")
            .style("fill", "#333")
            .text(featureNames[feature] || feature);

        if (chartWidth > 100 && chartHeight > 80) {
            chartArea.selectAll(".value-label")
                .data(featureData)
                .enter()
                .append("text")
                .attr("class", "value-label")
                .attr("x", d => x(d.cluster) + x.bandwidth() / 2)
                .attr("y", d => y(d.value) - 3)
                .attr("text-anchor", "middle")
                .style("font-size", "8px")
                .style("fill", "#333")
                .style("font-weight", "bold")
                .text(d => {
                    if (feature === "学习时间标准差") {
                        return Math.round(d.value) + "h";
                    } else if (d.value >= 1000) {
                        return (d.value / 1000).toFixed(1) + "k";
                    } else if (d.value < 1) {
                        return d.value.toFixed(2);
                    } else {
                        return d.value.toFixed(1);
                    }
                });
        }
    });


    const legendItemWidth = 70;
    const legendTotalWidth = centroids.length * legendItemWidth;
    const legendX = width - margin.left - margin.right - legendTotalWidth - 10;
    const legendY = height - margin.top - margin.bottom + 20;
    const legend = g.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${legendX}, ${legendY})`);

    centroids.forEach((centroid, i) => {
        const legendItem = legend.append("g")
            .attr("transform", `translate(${i * legendItemWidth}, 0)`);

        legendItem.append("rect")
            .attr("width", 12)
            .attr("height", 12)
            .attr("fill", clusterColors[i % clusterColors.length]);

        legendItem.append("text")
            .attr("x", 16)
            .attr("y", 10)
            .style("font-size", "11px")
            .style("fill", "#333")
            .text(`聚类 ${centroid.cluster}`);
    });
}

function createParallelCoordinates(data) {
    const svg = d3.select("#parallel-coordinates");
    const margin = { top: 50, right: 100, bottom: 100, left: 100 };
    const width = +svg.node().getBoundingClientRect().width;
    const height = 400;

    svg.attr("height", height);
    svg.selectAll("*").remove();

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const centroids = data.cluster_centroids_original_scale || [];

    if (centroids.length === 0) return;

    // 按照用户要求的顺序重新排列特征
    const featureOrder = [
        "平均学习记录数",     // 学习记录数
        "放弃率",             // 放弃率
        "平均学习时长(小时)", // 总学习时长（小时）
        "学习时间标准差",     // 时间标准差
        "平均单次学习时长",   // 平均单次时长（小时）
        "晚间学习占比",       // 晚间学习占比
        "平均完成度",         // 平均完成度
        "课程种类数",         // 课程种类数
        "重复学习率",         // 重复学习率
        "高完成率"            // 高完成率
    ];

    // 过滤出数据中实际存在的特征，并按照指定顺序排列
    const allFeatures = Object.keys(centroids[0]).filter(key => key !== 'cluster');
    const features = featureOrder.filter(feature => allFeatures.includes(feature));

    const scales = {};
    features.forEach(feature => {
        scales[feature] = d3.scaleLinear()
            .domain(d3.extent(centroids, d => d[feature]))
            .range([height - margin.top - margin.bottom, 0]);
    });

    const x = d3.scalePoint()
        .domain(features)
        .range([0, width - margin.left - margin.right]);

    features.forEach(feature => {
        g.append("g")
            .attr("transform", `translate(${x(feature)}, 0)`)
            .call(d3.axisLeft(scales[feature]));

        g.append("text")
            .attr("x", x(feature))
            .attr("y", height - margin.top - margin.bottom + 30)
            .attr("text-anchor", "middle")
            .style("font-size", "10px")
            .text(featureNames[feature] || feature)
            .attr("transform", `rotate(-45, ${x(feature)}, ${height - margin.top - margin.bottom + 30})`);
    });

    centroids.forEach((centroid, clusterIndex) => {
        const lineGenerator = d3.line()
            .x(feature => x(feature))
            .y(feature => scales[feature](centroid[feature]));

        g.append("path")
            .datum(features)
            .attr("d", lineGenerator)
            .attr("fill", "none")
            .attr("stroke", clusterColors[clusterIndex % clusterColors.length])
            .attr("stroke-width", 3)
            .attr("opacity", 0.7)
            .on("mouseover", function() {
                d3.select(this).attr("stroke-width", 5).attr("opacity", 1);
            })
            .on("mouseout", function() {
                d3.select(this).attr("stroke-width", 3).attr("opacity", 0.7);
            });

        features.forEach(feature => {
            g.append("circle")
                .attr("cx", x(feature))
                .attr("cy", scales[feature](centroid[feature]))
                .attr("r", 4)
                .attr("fill", clusterColors[clusterIndex % clusterColors.length])
                .on("mouseover", function(event) {
                    tooltip.transition()
                        .duration(200)
                        .style("opacity", .9);

                    let displayValue = centroid[feature].toFixed(2);
                    if (feature === "学习时间标准差") {
                        const hours = centroid[feature];
                        const days = Math.floor(hours / 24);
                        const remainingHours = (hours % 24).toFixed(1);
                        if (days > 0) {
                            displayValue = `${hours.toFixed(1)}小时 (约${days}天${remainingHours}小时)`;
                        } else {
                            displayValue = `${hours.toFixed(1)}小时`;
                        }
                    }

                    tooltip.html(`
                                聚类 ${centroid.cluster}<br>
                                ${featureNames[feature] || feature}: ${displayValue}
                            `)
                        .style("left", (event.pageX + 10) + "px")
                        .style("top", (event.pageY - 28) + "px");
                })
                .on("mouseout", function() {
                    tooltip.transition()
                        .duration(500)
                        .style("opacity", 0);
                });
        });
    });

    const legendItemWidth = 70;
    const legendTotalWidth = centroids.length * legendItemWidth;
    const legendX = (width - margin.left - margin.right - legendTotalWidth) / 2;
    const legendY = height - margin.top - margin.bottom + 70;
    const legend = g.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${legendX}, ${legendY})`);

    centroids.forEach((centroid, i) => {
        const legendItem = legend.append("g")
            .attr("transform", `translate(${i * legendItemWidth}, 0)`);

        legendItem.append("rect")
            .attr("width", 12)
            .attr("height", 12)
            .attr("fill", clusterColors[i % clusterColors.length]);

        legendItem.append("text")
            .attr("x", 16)
            .attr("y", 10)
            .style("font-size", "11px")
            .style("fill", "#333")
            .text(`聚类 ${centroid.cluster}`);
    });
}


function createCorrelationHeatmap(data) {
    const svg = d3.select("#correlation-heatmap");
    const margin = { top: 80, right: 150, bottom: 160, left: 120 };
    const width = +svg.node().getBoundingClientRect().width;
    const height = 600;

    svg.attr("height", height);
    svg.selectAll("*").remove();

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const centroids = data.cluster_centroids_original_scale || [];

    if (centroids.length === 0) return;

    const features = Object.keys(centroids[0]).filter(key => key !== 'cluster');

    function pearsonCorrelation(x, y) {
        const n = x.length;
        const sumX = d3.sum(x);
        const sumY = d3.sum(y);
        const sumXY = d3.sum(x.map((xi, i) => xi * y[i]));
        const sumX2 = d3.sum(x.map(xi => xi * xi));
        const sumY2 = d3.sum(y.map(yi => yi * yi));

        const numerator = n * sumXY - sumX * sumY;
        const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

        return denominator === 0 ? 0 : numerator / denominator;
    }

    const correlationData = [];
    for (let i = 0; i < features.length; i++) {
        for (let j = 0; j < features.length; j++) {
            const feature1 = features[i];
            const feature2 = features[j];

            const values1 = centroids.map(d => d[feature1]);
            const values2 = centroids.map(d => d[feature2]);

            const correlation = pearsonCorrelation(values1, values2);

            correlationData.push({
                i: i,
                j: j,
                feature1: feature1,
                feature2: feature2,
                correlation: correlation
            });
        }
    }

    const availableWidth = width - margin.left - margin.right - 150;
    const availableHeight = height - margin.top - margin.bottom;
    const cellSize = Math.min(availableWidth / features.length, availableHeight / features.length);


    const finalCellSize = Math.max(cellSize, 50);


    const heatmapWidth = features.length * finalCellSize;
    const heatmapHeight = features.length * finalCellSize;


    const offsetX = (availableWidth - heatmapWidth) / 2 + 80;
    const offsetY = (availableHeight - heatmapHeight) / 2;


    const heatmapG = g.append("g")
        .attr("transform", `translate(${offsetX}, ${offsetY})`);

    const colorScale = d3.scaleSequential(d3.interpolateRdBu)
        .domain([1, -1]);


    heatmapG.selectAll("rect")
        .data(correlationData)
        .enter()
        .append("rect")
        .attr("x", d => d.j * finalCellSize)
        .attr("y", d => d.i * finalCellSize)
        .attr("width", finalCellSize)
        .attr("height", finalCellSize)
        .attr("fill", d => colorScale(d.correlation))
        .attr("stroke", "#fff")
        .attr("stroke-width", 1)
        .on("mouseover", function(event, d) {
            d3.select(this).attr("stroke", "#333").attr("stroke-width", 2);

            tooltip.transition()
                .duration(200)
                .style("opacity", .9);
            tooltip.html(`
                        <strong>${featureNames[d.feature1] || d.feature1}</strong><br>
                        与<br>
                        <strong>${featureNames[d.feature2] || d.feature2}</strong><br>
                        相关系数: ${d.correlation.toFixed(3)}
                    `)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function() {
            d3.select(this).attr("stroke", "#fff").attr("stroke-width", 1);
            tooltip.transition()
                .duration(500)
                .style("opacity", 0);
        });


    heatmapG.selectAll("text.cell-text")
        .data(correlationData)
        .enter()
        .append("text")
        .attr("class", "cell-text")
        .attr("x", d => d.j * finalCellSize + finalCellSize / 2)
        .attr("y", d => d.i * finalCellSize + finalCellSize / 2)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .style("font-size", "10px")
        .style("fill", d => Math.abs(d.correlation) > 0.5 ? "white" : "black")
        .style("font-weight", "bold")
        .text(d => d.correlation.toFixed(2));


    heatmapG.selectAll("text.row-label")
        .data(features)
        .enter()
        .append("text")
        .attr("class", "row-label")
        .attr("x", -10)
        .attr("y", (d, i) => i * finalCellSize + finalCellSize / 2)
        .attr("text-anchor", "end")
        .attr("dominant-baseline", "middle")
        .style("font-size", "14px")
        .style("fill", "#333")
        .text(d => featureNames[d] || d);

    heatmapG.selectAll("text.col-label")
        .data(features)
        .enter()
        .append("text")
        .attr("class", "col-label")
        .attr("x", (d, i) => i * finalCellSize + finalCellSize / 2 - 30)
        .attr("y", features.length * finalCellSize + 90)
        .attr("text-anchor", "start")
        .attr("dominant-baseline", "middle")
        .style("font-size", "14px")
        .style("fill", "#333")
        .attr("transform", (d, i) => `rotate(-45, ${i * finalCellSize + finalCellSize / 2 - 30}, ${features.length * finalCellSize + 90})`)
        .text(d => featureNames[d] || d);

    const legendWidth = 15;
    const legendHeight = 200;
    const legendSteps = 20;

    const legend = g.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${offsetX + heatmapWidth + 30}, ${offsetY + 50})`);

    const defs = svg.append("defs");
    const gradient = defs.append("linearGradient")
        .attr("id", "correlation-gradient")
        .attr("x1", "0%")
        .attr("y1", "0%")
        .attr("x2", "0%")
        .attr("y2", "100%");

    for (let i = 0; i <= legendSteps; i++) {
        const value = 1 - (2 * i / legendSteps);
        gradient.append("stop")
            .attr("offset", `${(i / legendSteps) * 100}%`)
            .attr("stop-color", colorScale(value));
    }


    legend.append("rect")
        .attr("width", legendWidth)
        .attr("height", legendHeight)
        .style("fill", "url(#correlation-gradient)")
        .attr("stroke", "#333")
        .attr("stroke-width", 1);


    const legendScale = d3.scaleLinear()
        .domain([1, -1])
        .range([0, legendHeight]);

    const legendAxis = d3.axisRight(legendScale)
        .tickValues([1, 0.5, 0, -0.5, -1])
        .tickFormat(d3.format(".1f"));

    legend.append("g")
        .attr("transform", `translate(${legendWidth}, 0)`)
        .call(legendAxis)
        .selectAll("text")
        .style("font-size", "10px");

    legend.append("text")
        .attr("x", legendWidth / 2)
        .attr("y", -20)
        .attr("text-anchor", "middle")
        .style("font-size", "12px")
        .style("font-weight", "bold")
        .style("fill", "#333")
        .text("相关系数");

    legend.append("text")
        .attr("x", legendWidth / 2)
        .attr("y", legendHeight + 30)
        .attr("text-anchor", "middle")
        .style("font-size", "10px")
        .style("fill", "#666")
        .text("红色：正相关");

    legend.append("text")
        .attr("x", legendWidth / 2)
        .attr("y", legendHeight + 45)
        .attr("text-anchor", "middle")
        .style("font-size", "10px")
        .style("fill", "#666")
        .text("蓝色：负相关");
}