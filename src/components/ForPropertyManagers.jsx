import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
    Box,
    Button,
    Paper,
    Stack,
    Typography,
} from '@mui/material';
import Close from '@mui/icons-material/Close';
import Check from '@mui/icons-material/Check';
import ArrowForward from '@mui/icons-material/ArrowForward';
import HomeWork from '@mui/icons-material/HomeWork';
import PersonAdd from '@mui/icons-material/PersonAdd';
import Build from '@mui/icons-material/Build';
import TaskAlt from '@mui/icons-material/TaskAlt';
import FormatQuote from '@mui/icons-material/FormatQuote';
import { alpha, useTheme } from '@mui/material/styles';
import { Helmet } from 'react-helmet';
import { Heading } from '../styles';
import { useTranslation } from 'react-i18next';
import { withDarkPath } from '../routePaths';

const WorkflowStep = ({ step, icon, heading, body }) => {
    const theme = useTheme();
    return (
        <Stack direction="row" spacing={2.5} alignItems="flex-start">
            <Box
                sx={{
                    minWidth: 40,
                    height: 40,
                    borderRadius: '50%',
                    bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.2 : 0.1),
                    border: '2px solid',
                    borderColor: 'primary.main',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'primary.main',
                    flexShrink: 0,
                    mt: 0.25,
                }}
                aria-hidden
            >
                {icon || (
                    <Typography sx={{ fontWeight: 800, fontSize: '0.85rem', color: 'primary.main' }}>
                        {step}
                    </Typography>
                )}
            </Box>
            <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
                    {heading}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                    {body}
                </Typography>
            </Box>
        </Stack>
    );
};

const ForPropertyManagers = () => {
    const { t } = useTranslation();
    const theme = useTheme();
    const { pathname } = useLocation();

    const problems = [
        t('forPropertyManagers.problem1'),
        t('forPropertyManagers.problem2'),
        t('forPropertyManagers.problem3'),
        t('forPropertyManagers.problem4'),
    ];

    const workflowSteps = [
        { icon: <HomeWork sx={{ fontSize: '1.1rem' }} />, heading: t('forPropertyManagers.solution1Heading'), body: t('forPropertyManagers.solution1Body') },
        { icon: <PersonAdd sx={{ fontSize: '1.1rem' }} />, heading: t('forPropertyManagers.solution2Heading'), body: t('forPropertyManagers.solution2Body') },
        { icon: <Build sx={{ fontSize: '1.1rem' }} />, heading: t('forPropertyManagers.solution3Heading'), body: t('forPropertyManagers.solution3Body') },
        { icon: <TaskAlt sx={{ fontSize: '1.1rem' }} />, heading: t('forPropertyManagers.solution4Heading'), body: t('forPropertyManagers.solution4Body') },
    ];

    const testimonials = [
        { quote: t('forPropertyManagers.testimonial1Quote'), author: t('forPropertyManagers.testimonial1Author') },
        { quote: t('forPropertyManagers.testimonial2Quote'), author: t('forPropertyManagers.testimonial2Author') },
    ];

    const heroTint = alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.12 : 0.06);
    const heroBorder = alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.35 : 0.2);

    return (
        <Stack component="article" spacing={4.5}>
            <Helmet>
                <title>{t('forPropertyManagers.title')}</title>
                <meta name="description" content={t('forPropertyManagers.metaDescription')} />
            </Helmet>

            {/* Hero */}
            <Box
                sx={{
                    px: { xs: 2.25, sm: 3.5 },
                    py: { xs: 3.5, sm: 5 },
                    borderRadius: 2,
                    bgcolor: heroTint,
                    border: '1px solid',
                    borderColor: heroBorder,
                    textAlign: 'center',
                }}
            >
                <Heading>{t('forPropertyManagers.heading')}</Heading>
                <Typography
                    variant="subtitle1"
                    color="text.secondary"
                    sx={{ mt: 1.5, maxWidth: 560, mx: 'auto', lineHeight: 1.6 }}
                >
                    {t('forPropertyManagers.subheading')}
                </Typography>
            </Box>

            {/* Pain points */}
            <Box component="section" aria-labelledby="fpm-problems-heading">
                <Typography
                    id="fpm-problems-heading"
                    variant="h5"
                    component="h2"
                    sx={{ fontWeight: 700, mb: 2.5, textAlign: 'center' }}
                >
                    {t('forPropertyManagers.problemHeading')}
                </Typography>
                <Stack spacing={1.5}>
                    {problems.map((p, i) => (
                        <Paper
                            key={i}
                            elevation={0}
                            sx={{
                                p: 2,
                                border: '1px solid',
                                borderColor: 'divider',
                                borderRadius: 2,
                                backgroundImage: 'none',
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: 1.5,
                            }}
                        >
                            <Close
                                sx={{ fontSize: '1rem', color: 'error.main', mt: 0.2, flexShrink: 0 }}
                                aria-hidden
                            />
                            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                                {p}
                            </Typography>
                        </Paper>
                    ))}
                </Stack>
            </Box>

            {/* Solution / workflow */}
            <Box
                component="section"
                aria-labelledby="fpm-workflow-heading"
                sx={{
                    p: { xs: 2.5, sm: 4 },
                    borderRadius: 2,
                    bgcolor: heroTint,
                    border: '1px solid',
                    borderColor: heroBorder,
                }}
            >
                <Typography
                    id="fpm-workflow-heading"
                    variant="h5"
                    component="h2"
                    sx={{ fontWeight: 700, mb: 3, textAlign: 'center' }}
                >
                    {t('forPropertyManagers.solutionHeading')}
                </Typography>
                <Stack spacing={3}>
                    {workflowSteps.map((step, i) => (
                        <WorkflowStep
                            key={i}
                            step={i + 1}
                            icon={step.icon}
                            heading={step.heading}
                            body={step.body}
                        />
                    ))}
                </Stack>
            </Box>

            {/* Testimonials */}
            <Box component="section" aria-labelledby="fpm-testimonials-heading">
                <Typography
                    id="fpm-testimonials-heading"
                    variant="h5"
                    component="h2"
                    sx={{ fontWeight: 700, mb: 2.5, textAlign: 'center' }}
                >
                    {t('forPropertyManagers.testimonialsHeading')}
                </Typography>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2.5} useFlexGap>
                    {testimonials.map((item, i) => (
                        <Paper
                            key={i}
                            elevation={0}
                            sx={{
                                flex: 1,
                                p: 3,
                                border: '1px solid',
                                borderColor: 'divider',
                                borderRadius: 2,
                                backgroundImage: 'none',
                            }}
                        >
                            <FormatQuote
                                sx={{ fontSize: '2rem', color: 'primary.light', mb: 1, display: 'block' }}
                                aria-hidden
                            />
                            <Typography
                                variant="body1"
                                sx={{ fontStyle: 'italic', mb: 2, lineHeight: 1.7, color: 'text.primary' }}
                            >
                                {item.quote}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                                — {item.author}
                            </Typography>
                        </Paper>
                    ))}
                </Stack>
            </Box>

            {/* CTA */}
            <Box
                component="section"
                sx={{
                    textAlign: 'center',
                    py: { xs: 3.5, sm: 5 },
                    px: { xs: 2, sm: 3 },
                    borderRadius: 2,
                    bgcolor: heroTint,
                    border: '1px solid',
                    borderColor: heroBorder,
                }}
            >
                <Typography variant="h5" component="h2" sx={{ fontWeight: 700, mb: 1 }}>
                    {t('forPropertyManagers.ctaHeading')}
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                    {t('forPropertyManagers.ctaBody')}
                </Typography>
                <Button
                    component={Link}
                    to={withDarkPath(pathname, '/pricing')}
                    variant="contained"
                    size="large"
                    endIcon={<ArrowForward />}
                    aria-label={t('forPropertyManagers.ctaButtonAria')}
                    sx={{ textTransform: 'none', fontWeight: 700, px: 3.5, py: 1.3, borderRadius: 2 }}
                >
                    {t('forPropertyManagers.ctaButton')}
                </Button>
            </Box>
        </Stack>
    );
};

export default ForPropertyManagers;
