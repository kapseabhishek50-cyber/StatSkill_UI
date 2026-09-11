import { CloudShader } from '@/components/ui/cloud-shader';

export function CloudShaderDemo({ children, className }) {
  return (
    <CloudShader className={className || 'h-[40rem] w-full'}>
      {children}
    </CloudShader>
  );
}

export default CloudShaderDemo;
