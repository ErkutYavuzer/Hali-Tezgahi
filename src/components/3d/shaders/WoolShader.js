import * as THREE from 'three';

const woolVertexShader = `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying float vNoise;

  // Simple pseudo-random noise
  float random(vec2 st) {
      return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
  }

  // 3D Noise function (simplified)
  float noise(vec3 p) {
      vec3 i = floor(p);
      vec3 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(
          mix(mix(random(i.xy + vec2(0.0, 0.0)), random(i.xy + vec2(1.0, 0.0)), f.x),
              mix(random(i.xy + vec2(0.0, 1.0)), random(i.xy + vec2(1.0, 1.0)), f.x), f.y),
          mix(mix(random(i.xy + vec2(0.0, 0.0) + 1.0), random(i.xy + vec2(1.0, 0.0) + 1.0), f.x),
              mix(random(i.xy + vec2(0.0, 1.0) + 1.0), random(i.xy + vec2(1.0, 1.0) + 1.0), f.x), f.y), f.z);
  }

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = -mvPosition.xyz;

    // Displacement for "fluffy" look
    float n = noise(position * 20.0);
    vNoise = n;
    
    // Slight vertex displacement based on noise/normal
    vec3 newPos = position + normal * (n * 0.05);

    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPos, 1.0);
  }
`;

const woolFragmentShader = `
  uniform vec3 uColor;
  uniform vec3 uLightPosition;
  uniform float uTime;

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying float vNoise;

  void main() {
    // Normalization
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(vViewPosition);
    vec3 lightDir = normalize(uLightPosition - vViewPosition); // Simplified light

    // Diffuse lighting (Soft)
    float diff = max(dot(normal, lightDir), 0.0);
    
    // Rim Lighting (Fresnel effect for fuzziness)
    float rim = 1.0 - max(dot(viewDir, normal), 0.0);
    rim = pow(rim, 3.0); // Sharpen rim

    // Noise texture detail
    float noiseDetail = vNoise * 0.2;

    // Combine
    vec3 baseColor = uColor;
    vec3 finalColor = baseColor * (diff * 0.8 + 0.2) + (vec3(1.0) * rim * 0.4);
    
    // Add noise detail
    finalColor += noiseDetail;

    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

export const WoolMaterial = new THREE.ShaderMaterial({
    uniforms: {
        uColor: { value: new THREE.Color('#ffffff') },
        uLightPosition: { value: new THREE.Vector3(10, 20, 10) },
        uTime: { value: 0 }
    },
    vertexShader: woolVertexShader,
    fragmentShader: woolFragmentShader,
});

// Helper to create instance-ready material (cloning uniforms per instance is tricky with ShaderMaterial in InstancedMesh)
// For InstancedMesh, we might need a slightly different approach using onBeforeCompile or sticking to MeshStandardMaterial with custom shader injection.
// Let's stick to a high-quality MeshStandardMaterial for now with bump map if ShaderMaterial is too complex for instancing in one go.
// Or better: Use MeshStandardMaterial and modify it.

export const createWoolMaterial = (color) => {
    const mat = new THREE.MeshStandardMaterial({
        color: color,
        roughness: 0.9,
        metalness: 0.1,
    });

    mat.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = { value: 0 };
        shader.uniforms.uImpactPos = { value: new THREE.Vector3(0, 0, 0) };
        shader.uniforms.uImpactTime = { value: -999 };

        shader.vertexShader = `
            uniform float uTime;
            uniform vec3 uImpactPos;
            uniform float uImpactTime;
            varying float vNoise;
        ` + shader.vertexShader;

        shader.vertexShader = shader.vertexShader.replace(
            '#include <begin_vertex>',
            `
            #include <begin_vertex>
            
            // 🧶 Yün dokusu noise
            float n = sin(position.x * 50.0) * sin(position.y * 50.0) * sin(position.z * 50.0);
            vNoise = n;
            
            // 🌊 Dalgalanma (Ripple)
            // worldPosition henüz tanımlanmadığı için kendimiz hesaplıyoruz
            vec4 vWorldPos = modelMatrix * vec4(position, 1.0);
            float dist = distance(vWorldPos.xyz, uImpactPos);
            float timeElapsed = uTime - uImpactTime;
            float ripple = 0.0;
            
            if (timeElapsed > 0.0 && timeElapsed < 2.0) {
                float wave = sin(dist * 2.0 - timeElapsed * 10.0);
                float falloff = exp(-dist * 0.2) * exp(-timeElapsed * 2.0);
                ripple = wave * falloff * 0.5;
            }

            vec3 dispNormal = normalize(normal);
            transformed += dispNormal * (n * 0.03 + ripple); // Fuzz + Ripple
            `
        );

        // worldPosition vertex shader'da her zaman mevcut olmayabilir, ekleyelim
        shader.vertexShader = shader.vertexShader.replace(
            '#include <worldpos_vertex>',
            `
            #include <worldpos_vertex>
            // worldPosition zaten projeksiyon ve modelView ile hesaplanıyor, 
            // ama burada garantilemek için meshStandard içindekini kullanıyoruz.
            `
        );

        shader.fragmentShader = 'varying float vNoise;\n' + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <dithering_fragment>',
            `
            #include <dithering_fragment>
            // Fuzz highlight
            float rim = 1.0 - max(dot(normalize(vViewPosition), normalize(vNormal)), 0.0);
            gl_FragColor.rgb += vec3(0.1) * pow(rim, 3.0);
            gl_FragColor.rgb += vNoise * 0.05;
            `
        );
    };
    return mat;
};
