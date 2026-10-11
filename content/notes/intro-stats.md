# Intro Statistics course notes

Based on OpenStax Introductory Statistics 2e. One section per concept on the course map.

## Population vs. sample
The population is the whole group a question is about, such as every voter in a state. A sample is the part of that group actually measured, such as 1,000 voters reached by a poll. We study samples because measuring a whole population is usually too costly or impossible, and we use the sample to learn about the population. A sample only speaks for the population it was drawn from.

## Parameter vs. statistic
A parameter is a number that describes a population, such as the true mean height of all adults in a country. It is fixed but usually unknown. A statistic is a number computed from a sample, such as the mean height of 200 measured adults. Statistics are known but change from sample to sample. A handy memory aid: parameter goes with population, statistic goes with sample.

## Sampling variability
Two random samples from the same population almost never give exactly the same statistic. This sample-to-sample variation is called sampling variability. It is not a mistake in the method; it is a property of random sampling. Larger samples vary less, and the pattern of a statistic over many samples is called its sampling distribution.

## Standard error
The standard error is the standard deviation of a statistic's sampling distribution: how far the statistic typically lands from the parameter. For a sample mean it equals the population standard deviation divided by the square root of the sample size. Because of the square root, quadrupling the sample size cuts the standard error in half.

## Central Limit Theorem
The Central Limit Theorem says that for a large enough sample, the sampling distribution of the sample mean is approximately normal, whatever the shape of the population. Its center is the population mean and its spread is the standard error. A common rule of thumb is a sample of at least 30, with more needed for very skewed populations.

## Effect of sample size
Bigger samples give statistics that land closer to the parameter more often. The standard error shrinks in proportion to one over the square root of n, so the gains slow down: going from 100 to 400 halves the standard error, and going from 400 to 1,600 halves it again. Sample size does not fix bias, such as a sample drawn only from volunteers.

## Margin of error
The margin of error is how far a confidence interval reaches on each side of the estimate. It equals a critical value times the standard error. It grows with the confidence level, because more confidence needs a wider net, and it shrinks as the sample size grows. It covers random sampling error only, not bias from a poor sample.

## CI construction
A confidence interval for a mean is built as the point estimate plus or minus the margin of error: the sample mean plus or minus a critical value times the standard error. For 95% confidence with a normal sampling distribution the critical value is about 1.96. With a small sample and an unknown population standard deviation, the t distribution supplies the critical value instead.

## CI interpretation
A 95% confidence level describes the method. If we repeated the study many times, about 95% of the intervals built this way would contain the true mean. Once one interval is calculated, the mean is fixed, so that interval either contains it or does not. It is wrong to say there is a 95% probability that the true mean is in this particular interval.

## Null vs. alternative
A hypothesis test starts with two claims about a parameter. The null hypothesis is the default or no-effect claim, such as the mean equals 50. The alternative is what the study is looking for evidence of, such as the mean is greater than 50. The test asks whether the data are surprising enough under the null to reject it; failing to reject is not proof that the null is true.

## p-value
The p-value is the probability, assuming the null hypothesis is true, of getting data at least as extreme as what was observed. A small p-value means the data would be unusual if the null were true, which counts as evidence against the null. It is not the probability that the null is true, and it says nothing about how large or important an effect is.

## Type I / Type II errors
A Type I error is rejecting a true null hypothesis, a false alarm. Its probability is the significance level, alpha, often 0.05. A Type II error is failing to reject a false null, a missed effect. Lowering alpha makes Type I errors rarer but Type II errors more common for the same sample size; a larger sample reduces both.
